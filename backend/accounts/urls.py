from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view()),
    path('login/', views.LoginView.as_view()),
    path('logout/', views.LogoutView.as_view()),
    path('refresh/', views.CookieTokenRefreshView.as_view()),
    path('profile/', views.ProfileView.as_view()),
    path('profile/picture/', views.ProfilePictureUploadView.as_view()),
    path('addresses/', views.AddressBookView.as_view()),
    path('addresses/<uuid:id>/', views.AddressBookDetailView.as_view()),
    path('states/', views.StatesView.as_view()),
    path('cities/', views.CitiesView.as_view()),
    path('change-password/', views.ChangePasswordView.as_view()),
    path('forgot-password/', views.ForgotPasswordView.as_view()),
    path('reset-password/', views.ResetPasswordView.as_view()),
    path('transaction-pin/', views.TransactionPINView.as_view()),
    path('verify-pin/', views.VerifyTransactionPINView.as_view()),
]