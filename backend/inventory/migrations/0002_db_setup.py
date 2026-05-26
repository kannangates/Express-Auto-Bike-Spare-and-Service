"""
Consolidated database setup migration.

Runs after all app 0001_initial migrations to set up:
  - PostgreSQL extensions
  - Stored functions (order/return number generation, credit balance)
  - updated_at triggers for all tables
  - Performance indexes (GIN trigram, composite, partial)
  - Reporting views (low_stock_items, order_summary, customer_credit_summary)
  - Seed data (default inventory categories)
"""

from django.db import migrations


def create_initial_categories(apps, schema_editor):
    InventoryCategory = apps.get_model('inventory', 'InventoryCategory')
    categories = [
        ('Brake Parts',       'Brake pads, discs, calipers, and brake system components'),
        ('Engine Parts',      'Engine components, filters, spark plugs, and engine accessories'),
        ('Transmission',      'Clutch parts, gears, chains, and transmission components'),
        ('Electrical',        'Batteries, lights, wiring, and electrical components'),
        ('Body Parts',        'Fairings, mirrors, seats, and body accessories'),
        ('Wheels & Tires',    'Wheels, tires, tubes, and wheel accessories'),
        ('Suspension',        'Shocks, forks, springs, and suspension components'),
        ('Accessories',       'Helmets, gloves, bags, and riding accessories'),
        ('Tools & Equipment', 'Maintenance tools, diagnostic equipment, and shop supplies'),
        ('Lubricants',        'Engine oils, brake fluids, coolants, and lubricants'),
    ]
    for name, description in categories:
        InventoryCategory.objects.get_or_create(name=name, defaults={'description': description})


def remove_initial_categories(apps, schema_editor):
    InventoryCategory = apps.get_model('inventory', 'InventoryCategory')
    InventoryCategory.objects.filter(name__in=[
        'Brake Parts', 'Engine Parts', 'Transmission', 'Electrical',
        'Body Parts', 'Wheels & Tires', 'Suspension', 'Accessories',
        'Tools & Equipment', 'Lubricants',
    ]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('inventory',      '0001_initial'),
        ('orders',         '0001_initial'),
        ('returns',        '0001_initial'),
        ('notifications',  '0001_initial'),
        ('authentication', '0001_initial'),
    ]

    operations = [

        # ── Extensions ────────────────────────────────────────────────────────
        migrations.RunSQL(
            sql='CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
            reverse_sql='DROP EXTENSION IF EXISTS "uuid-ossp";',
        ),
        migrations.RunSQL(
            sql='CREATE EXTENSION IF NOT EXISTS "pg_trgm";',
            reverse_sql='DROP EXTENSION IF EXISTS "pg_trgm";',
        ),

        # ── Stored functions ──────────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS update_updated_at_column();",
        ),
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION generate_order_number()
            RETURNS TEXT AS $$
            DECLARE
                today TEXT;
                counter INTEGER;
            BEGIN
                today := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
                SELECT COUNT(*) + 1 INTO counter
                FROM customer_order
                WHERE DATE(created_at) = CURRENT_DATE;
                RETURN 'ORD-' || today || '-' || LPAD(counter::TEXT, 4, '0');
            END;
            $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS generate_order_number();",
        ),
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION generate_return_number()
            RETURNS TEXT AS $$
            DECLARE
                today TEXT;
                counter INTEGER;
            BEGIN
                today := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
                SELECT COUNT(*) + 1 INTO counter
                FROM customer_return
                WHERE DATE(created_at) = CURRENT_DATE;
                RETURN 'RET-' || today || '-' || LPAD(counter::TEXT, 4, '0');
            END;
            $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS generate_return_number();",
        ),
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE FUNCTION update_customer_credit_balance(
                p_customer_id      INTEGER,
                p_transaction_type VARCHAR(20),
                p_amount           DECIMAL(10,2),
                p_reference_type   VARCHAR(20) DEFAULT NULL,
                p_reference_id     INTEGER     DEFAULT NULL,
                p_description      TEXT        DEFAULT NULL,
                p_created_by       INTEGER     DEFAULT NULL
            )
            RETURNS VOID AS $$
            DECLARE
                current_balance DECIMAL(10,2);
                new_balance     DECIMAL(10,2);
            BEGIN
                SELECT balance INTO current_balance
                FROM customer_credit
                WHERE customer_id = p_customer_id;

                IF NOT FOUND THEN
                    INSERT INTO customer_credit (customer_id, balance, total_earned, total_used)
                    VALUES (p_customer_id, 0, 0, 0);
                    current_balance := 0;
                END IF;

                IF p_transaction_type = 'CREDIT' THEN
                    new_balance := current_balance + p_amount;
                    UPDATE customer_credit
                    SET balance = new_balance, total_earned = total_earned + p_amount
                    WHERE customer_id = p_customer_id;
                ELSIF p_transaction_type = 'DEBIT' THEN
                    IF current_balance < p_amount THEN
                        RAISE EXCEPTION 'Insufficient credit. Available: %, Requested: %',
                            current_balance, p_amount;
                    END IF;
                    new_balance := current_balance - p_amount;
                    UPDATE customer_credit
                    SET balance = new_balance, total_used = total_used + p_amount
                    WHERE customer_id = p_customer_id;
                ELSE
                    RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
                END IF;

                INSERT INTO credit_transaction (
                    customer_id, transaction_type, amount, balance_before, balance_after,
                    reference_type, reference_id, description, created_by
                ) VALUES (
                    p_customer_id, p_transaction_type, p_amount, current_balance, new_balance,
                    p_reference_type, p_reference_id, p_description, p_created_by
                );
            END;
            $$ LANGUAGE plpgsql;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS update_customer_credit_balance(INTEGER,VARCHAR,DECIMAL,VARCHAR,INTEGER,TEXT,INTEGER);",
        ),

        # ── updated_at triggers ───────────────────────────────────────────────
        migrations.RunSQL(
            sql="CREATE TRIGGER update_auth_user_updated_at BEFORE UPDATE ON auth_user FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();",
            reverse_sql="DROP TRIGGER IF EXISTS update_auth_user_updated_at ON auth_user;",
        ),
        migrations.RunSQL(
            sql="CREATE TRIGGER update_user_profile_updated_at BEFORE UPDATE ON user_profile FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();",
            reverse_sql="DROP TRIGGER IF EXISTS update_user_profile_updated_at ON user_profile;",
        ),
        migrations.RunSQL(
            sql="CREATE TRIGGER update_inventory_category_updated_at BEFORE UPDATE ON inventory_category FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();",
            reverse_sql="DROP TRIGGER IF EXISTS update_inventory_category_updated_at ON inventory_category;",
        ),
        migrations.RunSQL(
            sql="CREATE TRIGGER update_inventory_item_updated_at BEFORE UPDATE ON inventory_item FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();",
            reverse_sql="DROP TRIGGER IF EXISTS update_inventory_item_updated_at ON inventory_item;",
        ),
        migrations.RunSQL(
            sql="CREATE TRIGGER update_customer_order_updated_at BEFORE UPDATE ON customer_order FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();",
            reverse_sql="DROP TRIGGER IF EXISTS update_customer_order_updated_at ON customer_order;",
        ),
        migrations.RunSQL(
            sql="CREATE TRIGGER update_customer_return_updated_at BEFORE UPDATE ON customer_return FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();",
            reverse_sql="DROP TRIGGER IF EXISTS update_customer_return_updated_at ON customer_return;",
        ),
        migrations.RunSQL(
            sql="CREATE TRIGGER update_customer_credit_updated_at BEFORE UPDATE ON customer_credit FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();",
            reverse_sql="DROP TRIGGER IF EXISTS update_customer_credit_updated_at ON customer_credit;",
        ),

        # ── Performance indexes ───────────────────────────────────────────────
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_inventory_item_name_gin ON inventory_item USING gin(name gin_trgm_ops);",
            reverse_sql="DROP INDEX IF EXISTS idx_inventory_item_name_gin;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_customer_order_date_status ON customer_order(created_at, status);",
            reverse_sql="DROP INDEX IF EXISTS idx_customer_order_date_status;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_stock_transaction_item_date ON stock_transaction(item_id, created_at);",
            reverse_sql="DROP INDEX IF EXISTS idx_stock_transaction_item_date;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_credit_transaction_customer_date ON credit_transaction(customer_id, created_at);",
            reverse_sql="DROP INDEX IF EXISTS idx_credit_transaction_customer_date;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_notification_recipient_unread ON notification(recipient_id, is_read) WHERE is_read = FALSE;",
            reverse_sql="DROP INDEX IF EXISTS idx_notification_recipient_unread;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_order_item_item_date ON order_item(item_id, created_at);",
            reverse_sql="DROP INDEX IF EXISTS idx_order_item_item_date;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_return_item_condition ON return_item(condition, restockable);",
            reverse_sql="DROP INDEX IF EXISTS idx_return_item_condition;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_user_profile_name_gin ON user_profile USING gin((first_name || ' ' || last_name) gin_trgm_ops);",
            reverse_sql="DROP INDEX IF EXISTS idx_user_profile_name_gin;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_audit_log_user_date ON audit_log(user_id, created_at);",
            reverse_sql="DROP INDEX IF EXISTS idx_audit_log_user_date;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS idx_inventory_item_low_stock ON inventory_item(stock_quantity, min_stock_level) WHERE stock_quantity <= min_stock_level AND is_active = TRUE;",
            reverse_sql="DROP INDEX IF EXISTS idx_inventory_item_low_stock;",
        ),

        # ── Reporting views ───────────────────────────────────────────────────
        migrations.RunSQL(
            sql="""
            CREATE VIEW low_stock_items AS
            SELECT
                i.id, i.barcode, i.name,
                i.stock_quantity, i.min_stock_level,
                c.name AS category_name,
                (i.min_stock_level - i.stock_quantity) AS shortage_quantity
            FROM inventory_item i
            LEFT JOIN inventory_category c ON i.category_id = c.id
            WHERE i.stock_quantity <= i.min_stock_level AND i.is_active = TRUE;
            """,
            reverse_sql="DROP VIEW IF EXISTS low_stock_items;",
        ),
        migrations.RunSQL(
            sql="""
            CREATE VIEW order_summary AS
            SELECT
                o.id, o.order_number, o.status, o.total_amount,
                o.payment_status, o.created_at,
                CONCAT(up.first_name, ' ', up.last_name) AS customer_name,
                u.email AS customer_email,
                COUNT(oi.id)      AS item_count,
                SUM(oi.quantity)  AS total_quantity
            FROM customer_order o
            LEFT JOIN auth_user    u  ON o.customer_id = u.id
            LEFT JOIN user_profile up ON u.id = up.user_id
            LEFT JOIN order_item   oi ON o.id = oi.order_id
            GROUP BY o.id, o.order_number, o.status, o.total_amount,
                     o.payment_status, o.created_at, up.first_name, up.last_name, u.email;
            """,
            reverse_sql="DROP VIEW IF EXISTS order_summary;",
        ),
        migrations.RunSQL(
            sql="""
            CREATE VIEW customer_credit_summary AS
            SELECT
                cc.customer_id,
                CONCAT(up.first_name, ' ', up.last_name) AS customer_name,
                u.email AS customer_email,
                cc.balance, cc.total_earned, cc.total_used,
                cc.updated_at AS last_transaction_date
            FROM customer_credit cc
            JOIN  auth_user    u  ON cc.customer_id = u.id
            LEFT JOIN user_profile up ON u.id = up.user_id
            WHERE cc.balance > 0;
            """,
            reverse_sql="DROP VIEW IF EXISTS customer_credit_summary;",
        ),

        # ── Seed data ─────────────────────────────────────────────────────────
        migrations.RunPython(create_initial_categories, remove_initial_categories),
    ]
