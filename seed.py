from app import create_app, db
from app.models import Project
from datetime import date

app = create_app()

with app.app_context():
    p1 = Project (
        name='Lulu Oman SBD',
        client='Nike',
        description='SBD for Lulu Oman Haircare',
        value=12500.00,
        status='ON TRACK',
        deadline=date(2026, 5, 21)
                )
    
    p2 = Project(
        name='Carrefour DCC DPH',
        client='Carrefour',
        description='Carrefour DCC Project.',
        value=9500.00,
        status='DELAYED',
        deadline=date(2026, 5, 20)
    )

    p3 = Project(
        name='Adidas Brand Refresh',
        client='Adidas',
        description='Full brand identity refresh including logo and guidelines.',
        value=28000.00,
        status='AT RISK',
        deadline=date(2026, 6, 30)
      )
    
    db.session.add_all([p1, p2, p3])
    db.session.commit()
    print("Seeded Successfully")