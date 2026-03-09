from django.db import models

class Report(models.Model):
    class Meta:
        app_label = 'audit'

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    )

    DEVICE_CHOICES = (
        ('desktop', 'Desktop'),
        ('mobile', 'Mobile'),
    )

    NETWORK_CHOICES = (
        ('4g', '4G'),
        ('fast3g', 'Fast 3G'),
        ('slow3g', 'Slow 3G'),
    )

    url = models.URLField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    user_identifier = models.CharField(max_length=64, db_index=True, null=True, blank=True)
    device_type = models.CharField(max_length=10, choices=DEVICE_CHOICES, default='desktop')
    network_type = models.CharField(max_length=10, choices=NETWORK_CHOICES, default='4g')
    performance_score = models.IntegerField(null=True, blank=True)
    lighthouse_json = models.JSONField(null=True, blank=True)
    ai_summary = models.TextField(null=True, blank=True)
    screenshot = models.ImageField(upload_to='screenshots/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.url} - {self.status}"
