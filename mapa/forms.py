from django import forms

from .models import Ponto


class PontoForm(forms.ModelForm):
    class Meta:
        model = Ponto
        fields = ["nome", "bairro", "tipo", "lat", "lng", "horario", "telefone",
                  "aceita", "verificado_em", "imagem", "status"]

    def clean_imagem(self):
        img = self.cleaned_data.get("imagem")
        if img and hasattr(img, "size") and img.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Imagem maior que 5 MB.")
        return img


class SugestaoForm(forms.ModelForm):
    """Formulário público: só os campos básicos + foto opcional."""
    class Meta:
        model = Ponto
        fields = ["nome", "bairro", "tipo", "lat", "lng", "imagem"]

    def clean_imagem(self):
        img = self.cleaned_data.get("imagem")
        if img and hasattr(img, "size") and img.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Imagem maior que 5 MB.")
        return img

    def clean_lat(self):
        v = self.cleaned_data["lat"]
        if not -90 <= v <= 90:
            raise forms.ValidationError("Latitude inválida.")
        return v

    def clean_lng(self):
        v = self.cleaned_data["lng"]
        if not -180 <= v <= 180:
            raise forms.ValidationError("Longitude inválida.")
        return v
