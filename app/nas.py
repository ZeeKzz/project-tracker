import json
import requests
import urllib3
from flask import current_app

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from app.models import ProjectRegion, ProjectCustomer, Customer, Deliverable

# --------- Authentication ---------------

def _get_session():
    """Login to Synology File Station API, return (sid, host)."""
    host = current_app.config['NAS_HOST']
    port = current_app.config['NAS_PORT']
    resp = requests.get(
        f'https://{host}:{port}/webapi/auth.cgi',
        verify=False,
        params={
            'api':     'SYNO.API.Auth',
            'version': '3',
            'method':  'login',
            'account': current_app.config['NAS_USERNAME'],
            'passwd':  current_app.config['NAS_PASSWORD'],
            'session': 'FileStation',
            'format':  'sid',
        },
        timeout=10
    )
    print(f'NAS auth response: {resp.status_code} {resp.text}')
    data = resp.json()
    if not data.get('success'):
        raise RuntimeError(f"NAS login failed: {data}")
    return data['data']['sid'], host, port

def _logout(host, port, sid):
    """Logout and invalidate the session token."""
    requests.get(
        f'https://{host}:{port}/webapi/auth.cgi',
        verify=False,
        params={
            'api':     'SYNO.API.Auth',
            'version': '1',
            'method':  'logout',
            'session': 'FileStation',
            '_sid':    sid,
        },
        timeout=5
    )

# ------ Folder Operations --------
def _create_folder(host, port, sid, parent_path, folder_name):
    """
    Create a single folder inside parent_path.
    Silenty succeeds if folder already exists (force_parent=true)
    """
    resp = requests.get(
        f'https://{host}:{port}/webapi/entry.cgi',
        verify=False,
        params={
            'api':          'SYNO.FileStation.CreateFolder',
            'version':      '2',
            'method':       'create',
            'folder_path':  json.dumps([parent_path]),
            'name':         json.dumps([folder_name]),
            'force_parent': 'true',
            '_sid':         sid,
        },
        timeout=10
    )
    print(f'NAS create_folder {parent_path}/{folder_name}: {resp.json()}')

def _build_folder_tree(host, port, sid, project):
    """
    Build the full folder tree for a project on the NAS.
    Determines structure based on project.brief_type (Standard or C&CM).
    Year folder is auto-created if this is the first project of that year.
    """

    root         = current_app.config['NAS_PROJECT_ROOT']
    year         = project.created_at.year
    year_path    = f'{root}/{year}'
    client_name  = project.client_brand.name if project.client_brand else 'Unknown Client'
    client_path  = f'{year_path}/{client_name}'
    project_path = f'{client_path}/{project.name}'

    _create_folder(host, port, sid, root, str(year))
    _create_folder(host, port, sid, year_path, client_name)
    _create_folder(host, port, sid, client_path, project.name)

    for folder in ['Quotes & Invoices', 'Submissions', 'Reference Files', 'Design Files']:
        _create_folder(host, port, sid, project_path, folder)

    design_path = f'{project_path}/Design Files'

    if project.brief_type == 'ccm':
        _build_ccm_design_folders(host, port, sid, design_path, project)
    else:
        _build_standard_design_folders(host, port, sid, design_path, project)

def _build_standard_design_folders(host, port, sid, design_path, project):
    """
    Standard Brief:
       Design Files
          {Deliverable}/
              3D Files - Renders - Artwork - DWG - PDF  <- based on project teams
    """
    deliverables = Deliverable.query.filter_by(
        project_id=project.id,
        project_customer_id=None
    ).all()

    teams = [t.strip() for t in (project.design_teams_requested or '').split(',')]

    for d in deliverables:
        _create_folder(host, port, sid, design_path, d.name)
        d_path = f'{design_path}/{d.name}'

        if '3D' in teams:
            _create_folder(host, port, sid, d_path, '3D Files')
            _create_folder(host, port, sid, d_path, 'Renders')
        if '2D' in teams or '3D' in teams:
            _create_folder(host, port, sid, d_path, 'Artwork')
        if 'Technical' in teams or '3D' in teams:
            _create_folder(host, port, sid, d_path, 'DWG')
            _create_folder(host, port, sid, d_path, 'PDF')

def _build_ccm_design_folders(host, port, sid, design_path, project):
    """
    C&CM Brief:
    Design Files/
        {Region}/   <-- ProjectRegion.region string e.g. 'UAE, 'qatar
            {Customer}/  <-- customers where Customer.region matches
                {Deliverable}/
    """

    project_regions = ProjectRegion.query.filter_by(project_id=project.id).all()

    for pr in project_regions:
        region_name = pr.region
        _create_folder(host, port, sid, design_path, region_name)
        region_path = f'{design_path}/{region_name}'

        project_customers = (
            ProjectCustomer.query
            .filter_by(project_id=project.id)
            .join(ProjectCustomer.customer)
            .filter(Customer.region == region_name)
            .all()
        )

        for pc in project_customers:
            customer_name = pc.customer.name
            _create_folder(host, port, sid, region_path, customer_name)
            customer_path = f'{region_path}/{customer_name}'

            for d in pc.deliverables:
                _create_folder(host, port, sid, customer_path, d.name)

# ---- Project Interface -----------

def create_project_folders(project):
    """
    Main entry point - call this after a project is created.
    Failures are logged as warnings and never crash the calling route.
    """
    print(f'NAS: starting folder creation for project {project.id} — {project.name}')
    try:
        sid, host, port = _get_session()
        print(f'NAS: logged in, sid={sid}')
        try:
            _build_folder_tree(host, port, sid, project)
            print('NAS: folder tree built')
        finally:
            _logout(host, port, sid)
    except Exception as e:
        current_app.logger.warning(f'NAS folder creation failed for project {project.id}: {e}')
        print(f'NAS ERROR: {e}')
