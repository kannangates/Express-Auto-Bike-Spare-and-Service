from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('returns', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='credittransaction',
            index=models.Index(
                fields=['customer', 'transaction_type', 'reference_type', 'created_at'],
                name='credit_txn_customer_type_ref_idx',
            ),
        ),
    ]
