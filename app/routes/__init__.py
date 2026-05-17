from flask import Blueprint

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return '<h1>Project Tracker is running</h1>'

