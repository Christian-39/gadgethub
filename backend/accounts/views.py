import uuid
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from .models import AddressBook, PasswordResetToken
from .serializers import (
    RegisterSerializer, UserSerializer, AddressBookSerializer,
    ChangePasswordSerializer, TransactionPINSerializer
)

User = get_user_model()

def set_jwt_cookies(response, user):
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    response.set_cookie(
        'access_token', str(access),
        max_age=900, httponly=True, secure=not settings.DEBUG,
        samesite='None' if not settings.DEBUG else 'Lax', path='/'
    )
    response.set_cookie(
        'refresh_token', str(refresh),
        max_age=604800, httponly=True, secure=not settings.DEBUG,
        samesite='None' if not settings.DEBUG else 'Lax', path='/'
    )
    return response

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
            return set_jwt_cookies(response, user)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        response = Response(UserSerializer(user).data)
        return set_jwt_cookies(response, user)

class LogoutView(APIView):
    def post(self, request):
        response = Response({'success': 'Logged out'})
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        try:
            refresh = request.COOKIES.get('refresh_token')
            if refresh:
                token = RefreshToken(refresh)
                token.blacklist()
        except Exception:
            pass
        return response

class CookieTokenRefreshView(TokenRefreshView):
    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get('refresh_token')
        if refresh is None:
            return Response({'error': 'No refresh token'}, status=status.HTTP_401_UNAUTHORIZED)
        request.data['refresh'] = refresh
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access = response.data.get('access')
            response.set_cookie(
                'access_token', access,
                max_age=900, httponly=True, secure=not settings.DEBUG,
                samesite='None' if not settings.DEBUG else 'Lax', path='/'
            )
        return response

class ProfileView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user
        allowed = ['first_name', 'last_name', 'phone_number', 'address', 'city', 'state', 'theme_preference']
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        return Response(UserSerializer(user).data)

class ProfilePictureUploadView(APIView):
    def post(self, request):
        from utils.storage import upload_file_to_b2
        file = request.FILES.get('image')
        if not file:
            return Response({'error': 'No image provided'}, status=400)
        url = upload_file_to_b2(file, f"profiles/{request.user.id}/{uuid.uuid4()}.jpg")
        request.user.profile_picture = url
        request.user.save()
        return Response({'url': url})

class AddressBookView(generics.ListCreateAPIView):
    serializer_class = AddressBookSerializer

    def get_queryset(self):
        return AddressBook.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        addr = serializer.save(user=self.request.user)
        if addr.is_default:
            AddressBook.objects.filter(user=self.request.user).exclude(id=addr.id).update(is_default=False)

class AddressBookDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressBookSerializer
    lookup_field = 'id'

    def get_queryset(self):
        return AddressBook.objects.filter(user=self.request.user)

class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        if not request.user.check_password(serializer.validated_data['old_password']):
            return Response({'error': 'Incorrect current password'}, status=400)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'success': 'Password changed'})

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'success': 'If this email exists, a reset link has been sent.'})
        
        token = PasswordResetToken.objects.create(user=user)
        reset_url = f"https://gadgethub.vercel.app/reset-password.html?token={token.token}"
        send_mail(
            'GadgetHub Password Reset',
            f'Click to reset your password: {reset_url}',
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=True,
        )
        return Response({'success': 'If this email exists, a reset link has been sent.'})

class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        try:
            prt = PasswordResetToken.objects.get(token=token, used=False)
        except PasswordResetToken.DoesNotExist:
            return Response({'error': 'Invalid or expired token'}, status=400)
        
        if not prt.is_valid():
            return Response({'error': 'Token expired'}, status=400)
        
        prt.user.set_password(new_password)
        prt.user.save()
        prt.used = True
        prt.save()
        return Response({'success': 'Password reset successful'})

class TransactionPINView(APIView):
    def post(self, request):
        serializer = TransactionPINSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        request.user.transaction_pin = make_password(serializer.validated_data['pin'])
        request.user.pin_created = True
        request.user.save()
        return Response({'success': 'Transaction PIN created'})

    def put(self, request):
        old_pin = request.data.get('old_pin')
        if not check_password(old_pin, request.user.transaction_pin):
            return Response({'error': 'Incorrect current PIN'}, status=400)
        serializer = TransactionPINSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        request.user.transaction_pin = make_password(serializer.validated_data['pin'])
        request.user.save()
        return Response({'success': 'Transaction PIN updated'})

class VerifyTransactionPINView(APIView):
    def post(self, request):
        pin = request.data.get('pin')
        if not pin or not request.user.pin_created:
            return Response({'valid': False}, status=400)
        return Response({'valid': check_password(pin, request.user.transaction_pin)})