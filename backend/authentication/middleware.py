"""
JWT Session Middleware - bridges JWT tokens to Django session auth for admin access.
"""
import jwt
import logging
from django.conf import settings
from django.contrib.auth import login, get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


class JWTSessionMiddleware:
    """
    Middleware that reads a JWT token from the Authorization header or
    query param and logs the user into the Django session.
    This allows OWNER users to access /admin/ using their JWT token.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only apply to admin paths and only when user is not already authenticated
        if request.path.startswith('/admin/') and not request.user.is_authenticated:
            token = self._extract_token(request)
            if token:
                user = self._authenticate_token(token)
                if user and user.role == 'OWNER' and user.is_approved:
                    # Log user into Django session
                    user.backend = 'django.contrib.auth.backends.ModelBackend'
                    login(request, user)

        return self.get_response(request)

    def _extract_token(self, request):
        """Extract JWT from Authorization header or ?token= query param."""
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            return auth_header[7:]
        return request.GET.get('token')

    def _authenticate_token(self, token):
        """Decode JWT and return user if valid."""
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=['HS256'])
            if payload.get('type') != 'access':
                return None
            user_id = payload.get('user_id')
            return User.objects.get(id=user_id, is_active=True, is_approved=True)
        except Exception as e:
            logger.debug(f"JWT session middleware: token decode failed: {e}")
            return None
