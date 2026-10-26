import httpx
from app.core.config import settings

async def send_reset_password_email(to_email: str, reset_link: str):
    if not settings.BREVO_API_KEY:
        print(f"Mock Email sent to {to_email}. Reset link: {reset_link}")
        return True

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json"
    }
    payload = {
        "sender": {
            "name": getattr(settings, "BREVO_SENDER_NAME", "AutoExamGrading"),
            "email": getattr(settings, "BREVO_SENDER_EMAIL", "noreply@autoexam.com")
        },
        "to": [{"email": to_email}],
        "subject": "Password Reset Request",
        "htmlContent": f"<html><body><h1>Password Reset</h1><p>Click the link below to reset your password:</p><a href='{reset_link}'>{reset_link}</a></body></html>"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Failed to send email: {e}")
            return False
