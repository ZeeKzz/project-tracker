from flask import Blueprint, render_template, jsonify, request, abort
from flask_login import login_required, current_user
from app import db
from app.models import BlogPost, BlogComment, User
from datetime import datetime
import json

blog_bp = Blueprint('blog', __name__)

@blog_bp.route('/blog')
@login_required
def index():
    posts = BlogPost.query.filter_by(is_published=True)\
     .order_by(BlogPost.published_at.desc()).all()

    # Admins also see unpublished drafts
    if current_user.role == 'admin':
        posts = BlogPost.query.order_by(BlogPost.created_at.desc()).all()

    return render_template('blog/index.html', posts=posts)

@blog_bp.route('/blog/post/<int:post_id>')
@login_required
def get_post(post_id):
    post = BlogPost.query.get_or_404(post_id)

    # Non-admins can't see unpublished posts
    if not post.is_published and current_user.role != 'admin':
        abort(404)
    
    comments = BlogComment.query.filter_by(post_id=post_id)\
     .order_by(BlogComment.created_at.asc()).all()

    return render_template('blog/_post_content.html', post=post, comments=comments)

@blog_bp.route('/blog/post/<int:post_id>/comments', methods=['POST'])
@login_required
def add_comment(post_id):
    post = BlogPost.query.get_or_404(post_id)

    if not post.is_published and current_user.role != 'admin':
        abort(404)

    body = request.form.get('body', '').strip()
    if not body:
        return jsonify({'success': False, 'error': 'Comment cannot be empty'}), 400
    
    comment = BlogComment(
        post_id=post_id,
        user_id=current_user.id,
        body=body
    )
    db.session.add(comment)
    db.session.commit()

    return jsonify({
        'success': True,
        'comment': {
            'id': comment.id,
            'body': comment.body,
            'author': current_user.name,
            'created_at': comment.created_at.strftime('%d %b %Y, %H:%M')
        }
    })

@blog_bp.route('/blog/editor')
@login_required
def editor():
    if current_user.role != 'admin':
        abort(403)
    return render_template('blog/editor.html', post=None)

@blog_bp.route('/blog/editor/<int:post_id>')
@login_required
def editor_edit(post_id):
    if current_user.role != 'admin':
        abort(403)
    post = BlogPost.query.get_or_404(post_id)
    return render_template('blog/editor.html', post=post)

@blog_bp.route('/blog/posts', methods=['POST'])
@login_required
def create_post():
    if current_user.role != 'admin':
        abort(403)
    
    data = request.get_json()
    post = BlogPost(
        title=data['title'],
        version_tag=data.get('version_tag', ''),
        author_id=current_user.id,
        sections_json=json.dumps(data.get('sections', []))

    )
    db.session.add(post)
    db.session.commit()
    return jsonify({'success': True, 'post_id': post.id})

@blog_bp.route('/blog/posts/<int:post_id>', methods=['PUT'])
@login_required
def update_post(post_id):
    if current_user.role != 'admin':
        abort(403)
    
    post = BlogPost.query.get_or_404(post_id)
    data = request.get_json()
    post.title = data['title']
    post.version_tag = data.get('version_tag', '')
    post.sections_json = json.dumps(data.get('sections', []))
    db.session.commit()
    return jsonify({'success': True})

@blog_bp.route('/blog/posts/<int:post_id>/publish', methods=['POST'])
@login_required
def toggle_publish(post_id):
    if current_user.role != 'admin':
        abort(403)
    
    post = BlogPost.query.get_or_404(post_id)
    post.is_published = not post.is_published
    if post.is_published and not post.published_at:
        post.published_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'is_published': post.is_published})

@blog_bp.route('/blog/comments/<int:comment_id>', methods=['DELETE'])
@login_required
def delete_comment(comment_id):
    if current_user.role != 'admin':
        abort(403)
    
    comment = BlogComment.query.get_or_404(comment_id)
    db.session.delete(comment)
    db.session.commit()
    return jsonify({'success': True})

@blog_bp.route('/blog/posts/<int:post_id>', methods=['DELETE'])
@login_required
def delete_post(post_id):
    if current_user.role != 'admin':
        abort(403)

    post = BlogPost.query.get_or_404(post_id)
    db.session.delete(post)
    db.session.commit()
    return jsonify({'success': True})