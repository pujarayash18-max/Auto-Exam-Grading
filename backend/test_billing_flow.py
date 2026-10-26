import httpx
import json

BASE_URL = "http://localhost:8000"

def test_ai_billing():
    # 1. Login as SuperAdmin
    res = httpx.post(f"{BASE_URL}/api/v1/auth/login", data={"username": "superadmin", "password": "admin"})
    if res.status_code != 200:
        print("Login failed:", res.status_code, res.text)
        return
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("1. Logged in successfully as SuperAdmin")

    # 2. Get Settings
    res = httpx.get(f"{BASE_URL}/api/v1/admin/ai/settings", headers=headers)
    print("2. Settings fetched:", res.status_code)
    settings = res.json()
    print("   Active Provider:", settings["active_provider"])
    print("   Active Model:", settings["active_model"])
    print("   Merchant UPI:", settings["merchant_upi_id"])
    print("   Merchant Name:", settings["merchant_name"])
    print("   GST Rate %:", settings["gst_rate_percent"])
    print("   Token Balance:", settings["token_balance"])
    print("   Wallet INR:", settings["wallet_balance_inr"])

    # 3. Get Plans
    res = httpx.get(f"{BASE_URL}/api/v1/admin/ai/plans", headers=headers)
    print("3. Plans fetched:", res.status_code)
    plans_data = res.json()
    print("   Total plans:", len(plans_data["plans"]))
    for p in plans_data["plans"]:
        print(f"   - {p['name']}: {p['tokens']} tokens @ Rs.{p['price_inr']}")

    # 4. Create Recharge Order
    pro_plan = next(p for p in plans_data["plans"] if "Pro" in p["name"] or p["is_popular"])
    order_payload = {
        "plan_id": pro_plan["id"],
        "payment_method": "UPI"
    }
    res = httpx.post(f"{BASE_URL}/api/v1/admin/ai/recharge/create-order", json=order_payload, headers=headers)
    print("4. Order created:", res.status_code)
    order_data = res.json()
    txn_id = order_data["transaction_id"]
    print("   Transaction ID:", txn_id)
    print("   Total Payable INR:", order_data["total_payable_inr"])
    print("   UPI Intent String:", order_data["upi_intent_string"])

    # 5. Check Order Status
    res = httpx.get(f"{BASE_URL}/api/v1/admin/ai/recharge/order-status/{txn_id}", headers=headers)
    print("5. Order status check:", res.status_code, res.json()["status"])

    # 6. Verify Payment
    verify_payload = {
        "transaction_id": txn_id,
        "payment_method": "UPI",
        "utr_reference": "UTR123456789012"
    }
    res = httpx.post(f"{BASE_URL}/api/v1/admin/ai/recharge/verify-payment", json=verify_payload, headers=headers)
    print("6. Payment verified:", res.status_code)
    verify_data = res.json()
    print("   Invoice Number:", verify_data["invoice_number"])
    print("   Tokens Credited:", verify_data["tokens_credited"])
    print("   New Token Balance:", verify_data["new_token_balance"])
    print("   Tax Breakdown:", verify_data["tax_breakdown"])

    # 7. Check Invoice
    res = httpx.get(f"{BASE_URL}/api/v1/admin/ai/recharge/invoice/{txn_id}", headers=headers)
    print("7. Official Invoice fetched:", res.status_code)
    inv = res.json()
    print("   Merchant Name:", inv["merchant_name"])
    print("   Plan Name:", inv["plan_name"])
    print("   Total Amount INR:", inv["total_amount_inr"])

    # 8. Check Transactions list
    res = httpx.get(f"{BASE_URL}/api/v1/admin/ai/recharge/transactions", headers=headers)
    print("8. Transactions ledger count:", len(res.json()))

    # 9. Clean reset back to 0
    res = httpx.post(f"{BASE_URL}/api/v1/admin/ai/reset-balance?action=zero", headers=headers)
    print("9. Reset balance back to real 0:", res.json())

if __name__ == "__main__":
    test_ai_billing()
