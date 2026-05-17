from app import db

class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(50), default='ON TRACK')
    deadline = db.Column(db.Date, nullable=True)

    def __repr__(self):
        return f'<Project {self.name}>'
    
    
