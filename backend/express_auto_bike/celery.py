import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'express_auto_bike.settings')

app = Celery('express_auto_bike')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
