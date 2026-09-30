import os
from flask import Flask, render_template, request, jsonify, Response, redirect, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash
import csv
import io
import database as db

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY') or os.urandom(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax')

# Initialize database on app startup
db.init_db()


@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html')


@app.before_request
def require_api_login():
    if request.path.startswith('/api/') and 'user_id' not in session:
        return jsonify({'error': 'Authentication required.'}), 401


@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('index'))
    error = None
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        user = db.get_user_by_email(email)
        if user and check_password_hash(user['password_hash'], password):
            session.clear()
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('index'))
        error = 'Email or password is incorrect.'
    active_form = request.args.get('mode', 'login')
    if active_form not in ('login', 'register'):
        active_form = 'login'
    return render_template('login.html', error=error, active_form=active_form)


@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')
    if not username or len(username) > 80:
        error = 'Enter a username of 1 to 80 characters.'
    elif len(email) > 254 or '@' not in email:
        error = 'Enter a valid email address.'
    elif len(password) < 8:
        error = 'Password must be at least 8 characters.'
    else:
        user_id = db.create_user(
            username, email, generate_password_hash(password))
        if user_id:
            session.clear()
            session['user_id'] = user_id
            session['username'] = username
            return redirect(url_for('index'))
        error = 'That username or email is already registered.'
    return render_template('login.html', error=error, active_form='register'), 400


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/api/categories', methods=['GET'])
def get_categories():
    return jsonify(db.DEFAULT_CATEGORIES)


@app.route('/api/expenses', methods=['GET'])
def get_expenses_list():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')
    search = request.args.get('search')

    expenses = db.get_expenses(
        session['user_id'], start_date, end_date, category, search)
    total_spent = sum(e['amount'] for e in expenses)

    return jsonify({
        'expenses': expenses,
        'count': len(expenses),
        'total_spent': round(total_spent, 2)
    })


@app.route('/api/expenses', methods=['POST'])
def create_expense():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    amount = data.get('amount')
    category = data.get('category')
    subcategory = data.get('subcategory', '').strip()
    date = data.get('date')
    notes = data.get('notes', '').strip()

    if not title:
        return jsonify({'error': 'Expense title is required.'}), 400
    try:
        amount_val = float(amount)
        if amount_val <= 0:
            return jsonify({'error': 'Amount must be greater than zero.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Valid numerical amount is required.'}), 400

    if not category:
        return jsonify({'error': 'Category is required.'}), 400

    new_id = db.add_expense(session['user_id'], title, amount_val, category,
                            subcategory, date, notes)
    return jsonify({'message': 'Expense created successfully', 'id': new_id}), 201


@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense_item(expense_id):
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    amount = data.get('amount')
    category = data.get('category')
    subcategory = data.get('subcategory', '').strip()
    date = data.get('date')
    notes = data.get('notes', '').strip()

    if not title:
        return jsonify({'error': 'Expense title is required.'}), 400
    try:
        amount_val = float(amount)
        if amount_val <= 0:
            return jsonify({'error': 'Amount must be greater than zero.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Valid numerical amount is required.'}), 400

    db.update_expense(session['user_id'], expense_id, title, amount_val,
                      category, subcategory, date, notes)
    return jsonify({'message': 'Expense updated successfully'})


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense_item(expense_id):
    db.delete_expense(session['user_id'], expense_id)
    return jsonify({'message': 'Expense deleted successfully'})


@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')
    search = request.args.get('search')

    data = db.get_analytics_data(
        session['user_id'], start_date, end_date, category, search)
    return jsonify(data)


@app.route('/api/budgets', methods=['GET'])
def get_budgets_list():
    budgets = db.get_budgets(session['user_id'])
    return jsonify(budgets)


@app.route('/api/budgets', methods=['POST'])
def update_budget_limit():
    data = request.get_json() or {}
    category = data.get('category')
    monthly_limit = data.get('monthly_limit')

    if not category:
        return jsonify({'error': 'Category is required'}), 400
    try:
        limit_val = float(monthly_limit)
        if limit_val < 0:
            return jsonify({'error': 'Budget limit cannot be negative.'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Valid budget limit is required.'}), 400

    db.set_budget(session['user_id'], category, limit_val)
    return jsonify({'message': 'Budget updated successfully'})


@app.route('/api/export', methods=['GET'])
def export_csv():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')
    search = request.args.get('search')

    expenses = db.get_expenses(
        session['user_id'], start_date, end_date, category, search)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Date', 'Title', 'Category',
                    'Subcategory', 'Amount (INR)', 'Notes'])

    for e in expenses:
        writer.writerow([
            e['id'],
            e['date'],
            e['title'],
            e['category'],
            next((f"{item['icon']} {item['name']}"
                  for category in db.DEFAULT_CATEGORIES
                  if category['id'] == e['category']
                  for item in category['examples']
                  if item['name'] == e['subcategory']), e['subcategory']),
            f"{e['amount']:.2f}",
            e['notes']
        ])

    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = 'attachment; filename=expenses_export.csv'
    return response


if __name__ == '__main__':
    print("Starting Personal Expense Tracker Flask Application...")
    app.run(debug=True, port=5000)
