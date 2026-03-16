from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0004_sharedreport'),
    ]

    operations = [
        migrations.AddField(
            model_name='report',
            name='display_number',
            field=models.IntegerField(blank=True, db_index=True, null=True, unique=True),
        ),
    ]
