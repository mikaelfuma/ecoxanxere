from django.db import models


class Ponto(models.Model):
    TIPOS = [
        ("pilhas", "Pilhas e Baterias"),
        ("medicamentos", "Medicamentos"),
        ("oleo", "Óleo de Cozinha Usado"),
        ("eletronicos", "Resíduos Eletrônicos"),
        ("lampadas", "Lâmpadas Fluorescentes/Vapor"),
    ]
    STATUS = [
        ("pendente", "Pendente"),
        ("aprovado", "Aprovado"),
        ("rejeitado", "Rejeitado"),
    ]

    nome = models.CharField(max_length=120)
    bairro = models.CharField(max_length=80, default="Xanxerê")
    tipo = models.CharField(max_length=20, choices=TIPOS)
    lat = models.FloatField()
    lng = models.FloatField()
    horario = models.CharField("horário de funcionamento", max_length=120, blank=True)
    telefone = models.CharField(max_length=40, blank=True)
    aceita = models.CharField("o que aceita", max_length=255, blank=True)
    verificado_em = models.DateField("última verificação", blank=True, null=True)
    imagem = models.ImageField(upload_to="pontos/", blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUS, default="pendente")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.nome} ({self.get_tipo_display()})"


class Relato(models.Model):
    MOTIVOS = [
        ("fechou", "O local fechou / não recebe mais"),
        ("horario", "Horário errado"),
        ("mudou", "Mudou de endereço"),
        ("outro", "Outro problema"),
    ]
    ponto = models.ForeignKey(Ponto, on_delete=models.CASCADE, related_name="relatos")
    motivo = models.CharField(max_length=10, choices=MOTIVOS)
    detalhe = models.CharField(max_length=300, blank=True)
    resolvido = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.ponto.nome}: {self.get_motivo_display()}"
