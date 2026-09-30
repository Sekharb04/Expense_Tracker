import sqlite3
import os
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), 'expenses.db')

DEFAULT_CATEGORIES = [
    {
        'id': 'housing',
        'name': 'Housing',
        'icon': '🏠',
        'color': '#d4d4d4',
        'examples': [
            {'name': 'Rent', 'icon': '🏠'},
            {'name': 'Electricity', 'icon': '💡'},
            {'name': 'Water', 'icon': '💧'},
            {'name': 'Internet', 'icon': '📶'}
        ]
    },
    {
        'id': 'food',
        'name': 'Food',
        'icon': '🍔',
        'color': '#e3b341',
        'examples': [
            {'name': 'Groceries', 'icon': '🛒'},
            {'name': 'Restaurants', 'icon': '🍽️'},
            {'name': 'Delivery', 'icon': '🛵'}
        ]
    },
    {
        'id': 'transport',
        'name': 'Transport',
        'icon': '🚗',
        'color': '#70a5cf',
        'examples': [
            {'name': 'Fuel', 'icon': '⛽'},
            {'name': 'Vehicle', 'icon': '🚘'},
            {'name': 'Public Transport', 'icon': '🚇'},
            {'name': 'Taxi', 'icon': '🚕'}
        ]
    },
    {
        'id': 'shopping',
        'name': 'Shopping',
        'icon': '🛍️',
        'color': '#d77b8b',
        'examples': [
            {'name': 'Clothes', 'icon': '👕'},
            {'name': 'Electronics', 'icon': '📱'},
            {'name': 'Household purchases', 'icon': '🛋️'}
        ]
    },
    {
        'id': 'health',
        'name': 'Health',
        'icon': '❤️',
        'color': '#ef8a62',
        'examples': [
            {'name': 'Doctor', 'icon': '🩺'},
            {'name': 'Pharmacy', 'icon': '💊'},
            {'name': 'Fitness', 'icon': '🏋️'}
        ]
    },
    {
        'id': 'entertainment',
        'name': 'Entertainment',
        'icon': '🎬',
        'color': '#ad96cf',
        'examples': [
            {'name': 'Movies', 'icon': '🎟️'},
            {'name': 'Games', 'icon': '🎮'},
            {'name': 'Subscriptions', 'icon': '📺'}
        ]
    },
    {
        'id': 'travel',
        'name': 'Travel',
        'icon': '✈️',
        'color': '#56b4a3',
        'examples': [
            {'name': 'Hotels', 'icon': '🏨'},
            {'name': 'Flights', 'icon': '✈️'},
            {'name': 'Trips', 'icon': '🧳'}
        ]
    },
    {
        'id': 'other',
        'name': 'Other',
        'icon': '💳',
        'color': '#8494a3',
        'examples': [
            {'name': 'Miscellaneous', 'icon': '🧾'},
            {'name': 'Unexpected', 'icon': '❔'}
        ]
    }
]


def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL COLLATE NOCASE UNIQUE,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            subcategory TEXT DEFAULT '',
            date TEXT NOT NULL,
            notes TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    expense_columns = [row['name'] for row in cursor.execute(
        'PRAGMA table_info(expenses)').fetchall()]
    if 'user_id' not in expense_columns:
        cursor.execute(
            'ALTER TABLE expenses ADD COLUMN user_id INTEGER REFERENCES users(id)')

    budget_table = cursor.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'budgets'").fetchone()
    if budget_table:
        budget_columns = [row['name'] for row in cursor.execute(
            'PRAGMA table_info(budgets)').fetchall()]
        if 'user_id' not in budget_columns:
            cursor.execute('ALTER TABLE budgets RENAME TO budgets_legacy')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS budgets (
            user_id INTEGER NOT NULL REFERENCES users(id),
            category TEXT NOT NULL,
            monthly_limit REAL NOT NULL
            ,PRIMARY KEY (user_id, category)
        )
    ''')

    conn.commit()
    conn.close()


def create_user(username, email, password_hash):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
        ''', (username, email, password_hash))
    except sqlite3.IntegrityError:
        conn.close()
        return None

    user_id = cursor.lastrowid
    is_first_user = cursor.execute(
        'SELECT COUNT(*) FROM users').fetchone()[0] == 1
    if is_first_user:
        cursor.execute(
            'UPDATE expenses SET user_id = ? WHERE user_id IS NULL', (user_id,))
        legacy_budgets = cursor.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'budgets_legacy'").fetchone()
        if legacy_budgets:
            cursor.execute('''
                INSERT INTO budgets (user_id, category, monthly_limit)
                SELECT ?, category, monthly_limit FROM budgets_legacy
            ''', (user_id,))
            cursor.execute('DROP TABLE budgets_legacy')

    conn.commit()
    conn.close()
    return user_id


def get_user_by_email(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_expenses(user_id, start_date=None, end_date=None, category=None, search=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = 'SELECT * FROM expenses WHERE user_id = ?'
    params = [user_id]

    if start_date:
        query += ' AND date >= ?'
        params.append(start_date)
    if end_date:
        query += ' AND date <= ?'
        params.append(end_date)
    if category and category != 'all':
        query += ' AND category = ?'
        params.append(category)
    if search:
        query += ' AND (title LIKE ? OR subcategory LIKE ? OR notes LIKE ?)'
        search_pattern = f'%{search}%'
        params.extend([search_pattern, search_pattern, search_pattern])

    query += ' ORDER BY date DESC, id DESC'
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def add_expense(user_id, title, amount, category, subcategory='', date=None, notes=''):
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO expenses (user_id, title, amount, category, subcategory, date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, title, float(amount), category, subcategory, date, notes))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return new_id


def update_expense(user_id, expense_id, title, amount, category, subcategory='', date=None, notes=''):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE expenses
        SET title = ?, amount = ?, category = ?, subcategory = ?, date = ?, notes = ?
        WHERE id = ? AND user_id = ?
    ''', (title, float(amount), category, subcategory, date, notes, expense_id, user_id))
    conn.commit()
    conn.close()


def delete_expense(user_id, expense_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'DELETE FROM expenses WHERE id = ? AND user_id = ?', (expense_id, user_id))
    conn.commit()
    conn.close()


def get_budgets(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM budgets WHERE user_id = ?', (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return {row['category']: row['monthly_limit'] for row in rows}


def set_budget(user_id, category, monthly_limit):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO budgets (user_id, category, monthly_limit)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit
    ''', (user_id, category, float(monthly_limit)))
    conn.commit()
    conn.close()


def get_analytics_data(user_id, start_date=None, end_date=None, category=None, search=None):
    expenses = get_expenses(user_id, start_date, end_date, category, search)
    budgets = get_budgets(user_id)

    total_spent = sum(e['amount'] for e in expenses)
    expense_count = len(expenses)

    # Category breakdown
    category_totals = {}
    for cat in DEFAULT_CATEGORIES:
        category_totals[cat['id']] = 0.0

    for e in expenses:
        cat = e['category']
        category_totals[cat] = category_totals.get(cat, 0.0) + e['amount']

    # Daily trend timeline (sorted ascending by date)
    date_totals = {}
    for e in expenses:
        d = e['date']
        date_totals[d] = date_totals.get(d, 0.0) + e['amount']

    sorted_dates = sorted(date_totals.keys())
    daily_trend = [{'date': d, 'amount': round(
        date_totals[d], 2)} for d in sorted_dates]

    # Top category
    top_cat = None
    if category_totals:
        top_cat_id = max(category_totals, key=category_totals.get)
        if category_totals[top_cat_id] > 0:
            matching = [c for c in DEFAULT_CATEGORIES if c['id'] == top_cat_id]
            top_cat = {
                'id': top_cat_id,
                'name': matching[0]['name'] if matching else top_cat_id,
                'amount': round(category_totals[top_cat_id], 2),
                'icon': matching[0]['icon'] if matching else '💳'
            }

    # Category summary list with budget comparison
    category_summary = []
    for cat_def in DEFAULT_CATEGORIES:
        cid = cat_def['id']
        spent = round(category_totals.get(cid, 0.0), 2)
        limit = budgets.get(cid, 0.0)
        percentage = round((spent / limit * 100), 1) if limit > 0 else 0
        category_summary.append({
            'id': cid,
            'name': cat_def['name'],
            'icon': cat_def['icon'],
            'color': cat_def['color'],
            'examples': cat_def['examples'],
            'spent': spent,
            'budget': limit,
            'percentage': percentage
        })

    return {
        'total_spent': round(total_spent, 2),
        'expense_count': expense_count,
        'average_expense': round(total_spent / expense_count, 2) if expense_count > 0 else 0.0,
        'top_category': top_cat,
        'daily_trend': daily_trend,
        'category_totals': category_totals,
        'category_summary': category_summary,
        'budgets': budgets
    }
