from django.contrib import admin
from .models import Ponto, Relato


@admin.register(Ponto)
class PontoAdmin(admin.ModelAdmin):
    list_display = ("nome", "bairro", "tipo", "status", "criado_em")
    list_filter = ("status", "tipo")
    search_fields = ("nome", "bairro")
    actions = ["aprovar", "rejeitar"]

    @admin.action(description="Aprovar selecionados")
    def aprovar(self, request, queryset):
        queryset.update(status="aprovado")

    @admin.action(description="Rejeitar selecionados")
    def rejeitar(self, request, queryset):
        queryset.update(status="rejeitado")


@admin.register(Relato)
class RelatoAdmin(admin.ModelAdmin):
    list_display = ("ponto", "motivo", "resolvido", "criado_em")
    list_filter = ("resolvido", "motivo")
