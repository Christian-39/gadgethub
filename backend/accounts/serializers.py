from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from .models import AddressBook

User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'phone_number', 'password', 'password_confirm']

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords do not match.")
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        validated_data['password'] = make_password(validated_data['password'])
        validated_data['username'] = validated_data['email'].split('@')[0]
        return User.objects.create(**validated_data)

class UserSerializer(serializers.ModelSerializer):
    wishlist_count = serializers.SerializerMethodField()
    cart_count = serializers.SerializerMethodField()
    orders_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'phone_number',
            'profile_picture', 'address', 'city', 'state', 'theme_preference',
            'pin_created', 'account_number', 'bank_name', 'wishlist_count',
            'cart_count', 'orders_count', 'created_at'
        ]

    def get_wishlist_count(self, obj):
        return obj.wishlist_items.count()

    def get_cart_count(self, obj):
        return obj.cart_items.filter(ordered=False).count()

    def get_orders_count(self, obj):
        return obj.orders.count()

class AddressBookSerializer(serializers.ModelSerializer):
    class Meta:
        model = AddressBook
        fields = '__all__'
        read_only_fields = ['user']

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("New passwords do not match.")
        return data

class TransactionPINSerializer(serializers.Serializer):
    pin = serializers.CharField(required=True, min_length=6, max_length=6)
    confirm_pin = serializers.CharField(required=True, min_length=6, max_length=6)

    def validate(self, data):
        if data['pin'] != data['confirm_pin']:
            raise serializers.ValidationError("PINs do not match.")
        if not data['pin'].isdigit():
            raise serializers.ValidationError("PIN must contain only digits.")
        return data