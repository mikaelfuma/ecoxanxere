from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/pontos/", views.api_pontos),
    path("api/sugerir/", views.api_sugerir),
    path("como-descartar/", views.como_descartar, name="como_descartar"),
    path("api/reportar/", views.api_reportar),
    path("api/me/", views.api_me),
    path("api/login/", views.api_login),
    path("api/logout/", views.api_logout),
    path("api/admin/pontos/", views.api_admin_pontos),
    path("api/admin/pontos/salvar/", views.api_admin_salvar),
    path("api/admin/pontos/<int:pk>/status/", views.api_admin_status),
    path("api/admin/pontos/<int:pk>/excluir/", views.api_admin_excluir),
    path("api/admin/relatos/", views.api_admin_relatos),
    path("api/admin/relatos/<int:pk>/resolver/", views.api_admin_relato_resolver),
]
