"""
Custom middleware for Express Auto Bike Management System - Hybrid Deployment
"""

import logging
from django.http import JsonResponse
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings

logger = logging.getLogger(__name__)


class VercelIntegrationMiddleware(MiddlewareMixin):
    """
    Middleware to handle Vercel-specific integration requirements
    """
    
    def process_request(self, request):
        """
        Process incoming requests from Vercel frontend
        """
        # Log Vercel-specific headers for debugging
        vercel_headers = {
            'x-vercel-id': request.META.get('HTTP_X_VERCEL_ID'),
            'x-vercel-deployment-url': request.META.get('HTTP_X_VERCEL_DEPLOYMENT_URL'),
            'x-forwarded-for': request.META.get('HTTP_X_FORWARDED_FOR'),
            'x-forwarded-proto': request.META.get('HTTP_X_FORWARDED_PROTO'),
        }
        
        # Filter out None values
        vercel_headers = {k: v for k, v in vercel_headers.items() if v is not None}
        
        if vercel_headers:
            logger.info(f"Vercel request headers: {vercel_headers}")
        
        # Handle preflight OPTIONS requests for CORS
        if request.method == 'OPTIONS':
            response = JsonResponse({'status': 'ok'})
            
            # Set CORS headers for preflight requests
            origin = request.META.get('HTTP_ORIGIN')
            if origin and self._is_allowed_origin(origin):
                response['Access-Control-Allow-Origin'] = origin
                response['Access-Control-Allow-Credentials'] = 'true'
                response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
                response['Access-Control-Allow-Headers'] = ', '.join([
                    'Content-Type',
                    'Authorization',
                    'X-Requested-With',
                    'Accept',
                    'Origin',
                    'X-CSRFToken',
                    'X-Forwarded-For',
                    'X-Forwarded-Proto',
                    'X-Vercel-ID',
                    'X-Vercel-Deployment-URL',
                ])
                response['Access-Control-Max-Age'] = '86400'
            
            return response
        
        return None
    
    def process_response(self, request, response):
        """
        Process responses to Vercel frontend
        """
        # Add security headers for all responses
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Add CORS headers for actual requests
        origin = request.META.get('HTTP_ORIGIN')
        if origin and self._is_allowed_origin(origin):
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
            response['Vary'] = 'Origin'
        
        # Add cache headers for API responses
        if request.path.startswith('/api/'):
            if request.method == 'GET':
                # Cache GET requests for 5 minutes
                response['Cache-Control'] = 'public, max-age=300'
            else:
                # Don't cache non-GET requests
                response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response['Pragma'] = 'no-cache'
                response['Expires'] = '0'
        
        return response
    
    def _is_allowed_origin(self, origin):
        """
        Check if the origin is allowed based on CORS settings
        """
        # Check exact matches
        if hasattr(settings, 'CORS_ALLOWED_ORIGINS'):
            if origin in settings.CORS_ALLOWED_ORIGINS:
                return True
        
        # Check regex patterns for Vercel URLs
        if hasattr(settings, 'CORS_ALLOWED_ORIGIN_REGEXES'):
            import re
            for pattern in settings.CORS_ALLOWED_ORIGIN_REGEXES:
                if re.match(pattern, origin):
                    return True
        
        return False


class HealthCheckMiddleware(MiddlewareMixin):
    """
    Middleware to handle health check requests
    """
    
    def process_request(self, request):
        """
        Handle health check requests
        """
        if request.path == '/api/v1/health/':
            return self._health_check_response()
        
        return None
    
    def _health_check_response(self):
        """
        Generate health check response
        """
        try:
            # Check database connection
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            
            # Check Redis connection
            from django.core.cache import cache
            cache.set('health_check', 'ok', 10)
            cache_status = cache.get('health_check') == 'ok'
            
            if cache_status:
                return JsonResponse({
                    'status': 'healthy',
                    'database': 'connected',
                    'cache': 'connected',
                    'timestamp': str(timezone.now())
                })
            else:
                return JsonResponse({
                    'status': 'unhealthy',
                    'database': 'connected',
                    'cache': 'disconnected'
                }, status=503)
                
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            return JsonResponse({
                'status': 'unhealthy',
                'error': str(e)
            }, status=503)


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log requests for monitoring and debugging
    """
    
    def process_request(self, request):
        """
        Log incoming requests
        """
        # Only log API requests to avoid noise
        if request.path.startswith('/api/'):
            logger.info(
                f"API Request: {request.method} {request.path} "
                f"from {request.META.get('REMOTE_ADDR')} "
                f"User-Agent: {request.META.get('HTTP_USER_AGENT', 'Unknown')}"
            )
        
        return None
    
    def process_response(self, request, response):
        """
        Log response status for API requests
        """
        if request.path.startswith('/api/'):
            logger.info(
                f"API Response: {request.method} {request.path} "
                f"Status: {response.status_code}"
            )
        
        return response