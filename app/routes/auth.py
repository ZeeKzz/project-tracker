from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
from app.models import User
from app.decorators import role_required

auth = Blueprint('auth', __name__)

@auth.route('/register', methods=['GET', 'POST'])
@login_required
@role_required('admin')
def register():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password')
        role = request.form.get('role')
        team = request.form.get('team')

        errors = []

        if not name:
            errors.append('Full name is required.')
        if not email:
            errors.append('Email is required.')
        if not password:
            errors.append('Password is required.')
        if not role:
            errors.append('Role is required.')

        # Team is required only for designer and team_lead roles
        if role in ['designer', 'team_lead'] and not team:
            errors.append('Team must be selected for Designer and Team Lead roles.')

        # For roles that don't have a team, clear the team field
        if role not in ['designer', 'team_lead']:
            team = None

        # Check email uniqueness
        if email:
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                errors.append('An account with that email already exists.')

        if errors:
            for error in errors:
                flash(error, 'error')
            return redirect(url_for('auth.register'))

        hashed_password = generate_password_hash(password)

        new_user = User(
            name=name,
            email=email,
            password_hash=hashed_password,
            role=role,
            team=team
        )

        db.session.add(new_user)
        db.session.commit()

        flash(f'Account created successfully for {name}.', 'success')
        return redirect(url_for('auth.register'))

    return render_template('auth/register.html')

@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        user = User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password_hash, password):
            flash('Incorrect email or password.', 'error')
            return redirect(url_for('auth.login'))

        login_user(user)
        flash(f'Welcome back, {user.name}.', 'success')
        return redirect(url_for('main.index'))

    return render_template('auth/login.html')


@auth.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))

@auth.route('/account', methods=['GET', 'POST'])
@login_required
def account():
    if request.method == 'POST':
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')

        if not current_user.check_password(current_password):
            flash('Current password is incorrect.', 'error')
            return redirect(url_for('auth.account'))

        if new_password != confirm_password:
            flash('New passwords do not match.', 'error')
            return redirect(url_for('auth.account'))

        if len(new_password) < 8:
            flash('New password must be at least 8 characters.', 'error')
            return redirect(url_for('auth.account'))

        current_user.set_password(new_password)
        db.session.commit()
        flash('Password updated successfully.', 'success')
        return redirect(url_for('auth.account'))

    return render_template('auth/account.html')


@auth.route('/admin/users')
@login_required
@role_required('admin')
def admin_users():
    users = User.query.order_by(User.name).all()
    # dev_tools_enabled is injected globally via context processor in app/__init__.py
    return render_template('auth/users.html', users=users)


@auth.route('/admin/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
@role_required('admin')
def reset_password(user_id):
    user = User.query.get_or_404(user_id)
    user.set_password('Vitamin2026!')
    db.session.commit()
    flash(f'Password for {user.name} has been reset to Vitamin2026!', 'success')
    return redirect(url_for('auth.admin_users'))