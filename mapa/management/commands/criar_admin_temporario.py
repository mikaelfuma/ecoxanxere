
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import os


class Command(BaseCommand):
    help = "Cria um superusuário temporário usando variáveis de ambiente."

    def handle(self, *args, **options):
        User = get_user_model()

        username = os.environ.get("ADMIN_USERNAME")
        email = os.environ.get("ADMIN_EMAIL")
        password = os.environ.get("ADMIN_PASSWORD")

        if not username or not email or not password:
            raise ValueError(
                "Configure ADMIN_USERNAME, ADMIN_EMAIL e ADMIN_PASSWORD."
            )

        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING("Esse usuário já existe.")
            )
            return

        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )

        self.stdout.write(
            self.style.SUCCESS("Superusuário criado com sucesso.")
        )

