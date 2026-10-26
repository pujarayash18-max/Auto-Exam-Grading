import os
import sys
import json
import uuid
import hmac
import hashlib
import asyncio
import httpx

BACKEND_BASE_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000/api/v1")
YOUPI_API_URL = os.environ.get("YOUPI_API_URL", "http://host.docker.internal:6100")
YOUPI_CHECKOUT_URL = os.environ.get("YOUPI_CHECKOUT_URL", "http://host.docker.internal:7000")


async def get_superadmin_token() -> str:
    from app.api.deps import AsyncSessionLocal
    from app.models.user import User, RoleEnum
    from app.core.security import create_access_token
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.role == RoleEnum.SUPERADMIN))
        admin = res.scalars().first()
        if not admin:
            raise Exception("No SUPERADMIN found in viva_db")
        return create_access_token({"sub": str(admin.id), "role": admin.role.value})


async def run_test():
    print("============================================================")
    print("🧪 AUTOEXAM + YOUPI-PG INTEGRATION END-TO-END VERIFICATION")
    print("============================================================")

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Step 1: Health check of YouPI Core API and Checkout Portal
        print("\n[Step 1/7] Testing YouPI Payment API & Checkout Portal health...")
        try:
            r_api = await client.get(f"{YOUPI_API_URL}/health")
            assert r_api.status_code == 200, f"YouPI API health failed: {r_api.status_code}"
            print(f"  [✓] YouPI Payment Core API Online at {YOUPI_API_URL} ({r_api.json().get('status')})")

            r_portal = await client.get(f"{YOUPI_CHECKOUT_URL}/health")
            assert r_portal.status_code == 200, f"YouPI Checkout Portal health failed: {r_portal.status_code}"
            print(f"  [✓] YouPI Checkout Portal Online at {YOUPI_CHECKOUT_URL} ({r_portal.json().get('status')})")
        except Exception as e:
            print(f"  [x] YouPI health check failed: {e}")
            sys.exit(1)

        # Step 2: Acquire SuperAdmin JWT token
        print("\n[Step 2/7] Generating SuperAdmin Session Token...")
        try:
            token = await get_superadmin_token()
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            print(f"  [✓] SuperAdmin authorization token generated successfully.")
        except Exception as e:
            print(f"  [x] Token generation failed: {e}")
            sys.exit(1)

        # Step 3: Test backend-to-YouPI test ping
        print("\n[Step 3/7] Testing Backend-to-YouPI connectivity test endpoint...")
        try:
            conn_res = await client.get(
                f"{BACKEND_BASE_URL}/admin/ai/recharge/test-youpi-connection",
                headers=headers
            )
            assert conn_res.status_code == 200, f"Test connection failed: {conn_res.status_code}"
            conn_data = conn_res.json()
            assert conn_data.get("connected") is True, f"YouPI connection not reported True: {conn_data}"
            print(f"  [✓] Backend successfully pinged YouPI: {conn_data.get('gateway_response')}")
        except Exception as e:
            print(f"  [x] Test connection failed: {e}")
            sys.exit(1)

        # Step 4: Create a Recharge Order via YouPI
        print("\n[Step 4/7] Creating AI Recharge Order with YouPI Sovereign Gateway...")
        try:
            order_res = await client.post(
                f"{BACKEND_BASE_URL}/admin/ai/recharge/create-order",
                headers=headers,
                json={
                    "plan_id": "plan_starter",
                    "payment_method": "YOUPI"
                }
            )
            assert order_res.status_code == 200, f"Order creation failed: {order_res.status_code} - {order_res.text}"
            order = order_res.json()
            txn_id = order.get("transaction_id")
            youpi_pid = order.get("youpi_payment_id")
            checkout_url = order.get("youpi_checkout_url")
            total_payable = order.get("total_payable_inr")

            assert order.get("is_youpi") is True, "is_youpi is not True"
            assert txn_id, "No transaction_id returned"
            assert youpi_pid, "No youpi_payment_id returned"
            assert checkout_url, "No youpi_checkout_url returned"

            print(f"  [✓] Order Created Successfully:")
            print(f"      • Transaction ID:   {txn_id}")
            print(f"      • YouPI Payment ID: {youpi_pid}")
            print(f"      • Total Payable:    ₹{total_payable}")
            print(f"      • Checkout URL:     {checkout_url}")
        except Exception as e:
            print(f"  [x] Create order failed: {e}")
            sys.exit(1)

        # Step 5: Check initial order status
        print("\n[Step 5/7] Polling initial order status...")
        try:
            status_res = await client.get(
                f"{BACKEND_BASE_URL}/admin/ai/recharge/order-status/{txn_id}",
                headers=headers
            )
            assert status_res.status_code == 200, f"Status check failed: {status_res.status_code}"
            status_data = status_res.json()
            print(f"  [✓] Status confirmed: {status_data.get('status')} (Tokens: {status_data.get('amount_inr')} INR)")
        except Exception as e:
            print(f"  [x] Initial status check failed: {e}")
            sys.exit(1)

        # Step 6: Dispatch signed YouPI Webhook event (SUCCESS)
        print("\n[Step 6/7] Dispatching HMAC-SHA256 Signed YouPI Webhook...")
        try:
            # Query the authoritative webhook secret from database
            from app.api.deps import AsyncSessionLocal
            from app.models.ai_billing import AISettings
            from sqlalchemy import select

            async with AsyncSessionLocal() as session:
                res_s = await session.execute(select(AISettings))
                s_obj = res_s.scalars().first()
                secret = (s_obj.youpi_webhook_secret if s_obj and s_obj.youpi_webhook_secret else "sec_youpi_autoexam_webhook_key")

            webhook_payload = {
                "event": "SUCCESS",
                "paymentId": youpi_pid,
                "orderId": txn_id,
                "amount": str(total_payable),
                "amountPaise": int(total_payable * 100),
                "currency": "INR",
                "method": "UPI",
                "utr": f"UTR{uuid.uuid4().int % 1000000000000:012d}",
                "status": "SUCCESS"
            }
            body_bytes = json.dumps(webhook_payload).encode("utf-8")
            signature = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

            wh_res = await client.post(
                f"{BACKEND_BASE_URL}/admin/ai/recharge/webhook/youpi",
                headers={
                    "Content-Type": "application/json",
                    "X-Gateway-Event": "SUCCESS",
                    "X-Gateway-Signature": f"sha256={signature}",
                    "X-Gateway-Delivery-Id": str(uuid.uuid4())
                },
                content=body_bytes
            )
            assert wh_res.status_code == 200, f"Webhook listener rejected signed payload: {wh_res.status_code} - {wh_res.text}"
            wh_data = wh_res.json()
            print(f"  [✓] Webhook accepted & processed: {wh_data}")
        except Exception as e:
            print(f"  [x] Webhook delivery failed: {e}")
            sys.exit(1)

        # Step 7: Verify final settlement, token wallet credit, and tax invoice
        print("\n[Step 7/7] Verifying final settlement, wallet balance, and tax invoice...")
        try:
            final_status_res = await client.get(
                f"{BACKEND_BASE_URL}/admin/ai/recharge/order-status/{txn_id}",
                headers=headers
            )
            assert final_status_res.status_code == 200
            final_data = final_status_res.json()
            assert final_data.get("status") == "COMPLETED", f"Status is not COMPLETED: {final_data}"
            assert final_data.get("invoice_number"), f"No invoice_number generated: {final_data}"

            # Fetch detailed tax invoice
            inv_res = await client.get(
                f"{BACKEND_BASE_URL}/admin/ai/recharge/invoice/{txn_id}",
                headers=headers
            )
            assert inv_res.status_code == 200
            inv_data = inv_res.json()

            print(f"  [✓] Transaction COMPLETED & Settled!")
            print(f"      • Invoice Number:   {inv_data.get('invoice_number')}")
            print(f"      • Tokens Credited:  {inv_data.get('tokens_credited'):,}")
            print(f"      • New Wallet Total: {final_data.get('new_token_balance'):,} Tokens")
            print(f"      • Tax Breakdown:    Base ₹{inv_data.get('base_amount_inr')} + CGST ₹{inv_data.get('cgst_inr')} + SGST ₹{inv_data.get('sgst_inr')} = Total ₹{inv_data.get('total_amount_inr')}")
        except Exception as e:
            print(f"  [x] Final verification failed: {e}")
            sys.exit(1)

    print("\n============================================================")
    print("🎉 ALL TESTS PASSED: YouPI-PG is 100% OPERATIONAL & INTEGRATED!")
    print("============================================================\n")


if __name__ == "__main__":
    asyncio.run(run_test())
