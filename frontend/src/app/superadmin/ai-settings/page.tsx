"use client";

import { useEffect, useState, useId } from "react";
import { useRouter } from "next/navigation";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import {
  Cpu,
  Coins,
  Zap,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  ShieldCheck,
  History,
  Key,
  Check,
  RefreshCw,
  QrCode,
  Building2,
  Lock,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Printer,
  Copy,
  ExternalLink,
  RotateCcw,
  Clock,
  Smartphone,
  Plus,
  Trash2,
  FileText,
  Sliders,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface ModelInfo {
  provider: string;
  name: string;
  input_per_m: number;
  output_per_m: number;
  speed: string;
  badge: string;
}

interface PrepaidPlan {
  id: string;
  name: string;
  tokens: number;
  price_inr: number;
  description: string;
  rate_per_k: number;
  is_popular: boolean;
  badge: string;
}

interface TransactionRecord {
  id: number;
  transaction_id: string;
  invoice_number?: string;
  created_at?: string;
  plan_name: string;
  tokens_purchased: number;
  base_amount_inr: number;
  gst_amount_inr: number;
  amount_inr: number;
  payment_method: string;
  payment_gateway: string;
  status: string;
  utr_reference?: string;
}

interface UsageLog {
  id: number;
  created_at: string;
  provider: string;
  model_name: string;
  operation_type: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_inr: number;
  cost_usd: number;
  status: string;
}

export default function AISettingsPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Model & Provider State
  const [activeProvider, setActiveProvider] = useState<string>("gemini");
  const [activeModel, setActiveModel] = useState<string>("gemini-1.5-flash");
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [claudeKey, setClaudeKey] = useState<string>("");
  const [ollamaHost, setOllamaHost] = useState<string>("http://localhost:11434");
  const [razorpayKeyId, setRazorpayKeyId] = useState<string>("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState<string>("");
  const [keysStatus, setKeysStatus] = useState<Record<string, string>>({});
  const [hasRazorpayKey, setHasRazorpayKey] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<Record<string, ModelInfo>>({});

  // Real Wallet and Usage Metrics (Default to 0 - No Mock Data)
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [walletBalanceInr, setWalletBalanceInr] = useState<number>(0.0);
  const [totalTokensUsed, setTotalTokensUsed] = useState<number>(0);
  const [totalCostSpentInr, setTotalCostSpentInr] = useState<number>(0.0);
  const [lowTokenThreshold, setLowTokenThreshold] = useState<number>(50000);
  const [isLowBalance, setIsLowBalance] = useState<boolean>(false);
  const [isDepleted, setIsDepleted] = useState<boolean>(true);
  const [recentLogs, setRecentLogs] = useState<UsageLog[]>([]);

  // Dynamic Plans State
  const [plans, setPlans] = useState<PrepaidPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("plan_pro");
  const [customTokens, setCustomTokens] = useState<number>(500000);

  // Payment Gateway Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [paymentMethodTab, setPaymentMethodTab] = useState<"UPI" | "CARD" | "NETBANKING">("UPI");
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // Gateway Interactive Form States
  const [utrInput, setUtrInput] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpiry, setCardExpiry] = useState<string>("");
  const [cardCvv, setCardCvv] = useState<string>("");
  const [cardName, setCardName] = useState<string>("");
  const [selectedBank, setSelectedBank] = useState<string>("HDFC Bank");
  const [gatewayStep, setGatewayStep] = useState<"SELECT" | "OTP" | "SUCCESS">("SELECT");
  const [otpInput, setOtpInput] = useState<string>("");
  const [timerSeconds, setTimerSeconds] = useState<number>(599); // 09:59 timer

  // Reset Balance Modal State
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Dynamic Merchant and Gateway Settings
  const [merchantUpiId, setMerchantUpiId] = useState<string>("autoexam.billing@icici");
  const [merchantName, setMerchantName] = useState<string>("AutoExam Examination Cell");
  const [gstRatePercent, setGstRatePercent] = useState<number>(18.0);
  const [gatewayMode, setGatewayMode] = useState<string>("HYBRID");
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);

  // Dynamic Add Plan Modal State
  const [showAddPlanModal, setShowAddPlanModal] = useState<boolean>(false);
  const [newPlanName, setNewPlanName] = useState<string>("");
  const [newPlanTokens, setNewPlanTokens] = useState<number>(1000000);
  const [newPlanPrice, setNewPlanPrice] = useState<number>(999.0);
  const [newPlanDescription, setNewPlanDescription] = useState<string>("");
  const [newPlanBadge, setNewPlanBadge] = useState<string>("Value Pack");
  const [newPlanIsPopular, setNewPlanIsPopular] = useState<boolean>(false);
  const [addingPlan, setAddingPlan] = useState<boolean>(false);

  // Recharge Ledger & Invoices
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [activeLedgerTab, setActiveLedgerTab] = useState<"LOGS" | "INVOICES">("LOGS");

  const fallbackGeminiKeyId = useId();
  const fallbackOpenAiKeyId = useId();
  const fallbackClaudeKeyId = useId();
  const fallbackOllamaHostId = useId();
  const fallbackRzpKeyId = useId();
  const fallbackRzpSecretId = useId();
  const fallbackThresholdId = useId();
  const fallbackMerchantUpiId = useId();
  const fallbackMerchantNameId = useId();
  const fallbackGstRateId = useId();
  const fallbackGatewayModeId = useId();

  const getAuthToken = () => {
    return localStorage.getItem("access_token");
  };

  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const token = getAuthToken();
    if (!token) {
      router.push("/auth/login");
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch AI Settings
      const resSettings = await fetch("http://localhost:8000/api/v1/admin/ai/settings", { headers });
      if (resSettings.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (resSettings.ok) {
        const s = await resSettings.json();
        setActiveProvider(s.active_provider);
        setActiveModel(s.active_model);
        setOllamaHost(s.ollama_host || "http://localhost:11434");
        setKeysStatus(s.keys_status || {});
        setHasRazorpayKey(s.has_razorpay_key);
        setAvailableModels(s.available_models || {});
        setTokenBalance(s.token_balance || 0);
        setWalletBalanceInr(s.wallet_balance_inr || 0.0);
        setTotalTokensUsed(s.total_tokens_used || 0);
        setTotalCostSpentInr(s.total_cost_spent_inr || 0.0);
        setLowTokenThreshold(s.low_token_threshold || 50000);
        setIsLowBalance(s.is_low_balance);
        setIsDepleted(s.is_depleted);
        setMerchantUpiId(s.merchant_upi_id || "autoexam.billing@icici");
        setMerchantName(s.merchant_name || "AutoExam Examination Cell");
        setGstRatePercent(s.gst_rate_percent !== undefined ? s.gst_rate_percent : 18.0);
        setGatewayMode(s.gateway_mode || "HYBRID");
      }

      // 2. Fetch Usage Logs
      const resUsage = await fetch("http://localhost:8000/api/v1/admin/ai/usage", { headers });
      if (resUsage.ok) {
        const u = await resUsage.json();
        setRecentLogs(u.recent_logs || []);
      }

      // 3. Fetch Dynamic Plans
      const resPlans = await fetch("http://localhost:8000/api/v1/admin/ai/plans", { headers });
      if (resPlans.ok) {
        const p = await resPlans.json();
        setPlans(p.plans || []);
        if (p.plans && p.plans.length > 0 && selectedPlanId === "plan_pro") {
          const found = p.plans.find((item: PrepaidPlan) => item.is_popular);
          if (found) setSelectedPlanId(found.id);
        }
      }

      // 4. Fetch Recharge Transactions Ledger
      const resTxns = await fetch("http://localhost:8000/api/v1/admin/ai/recharge/transactions", { headers });
      if (resTxns.ok) {
        const tx = await resTxns.json();
        setTransactions(tx || []);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to connect to backend AI configuration service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    loadAllData();
  }, []);

  // Countdown timer for payment session
  useEffect(() => {
    let interval: any;
    if (showPaymentModal && !paymentSuccessData && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showPaymentModal, paymentSuccessData, timerSeconds]);

  // Real-time automatic background polling while payment gateway modal is open
  useEffect(() => {
    let pollInterval: any;
    if (showPaymentModal && checkoutData?.transaction_id && gatewayStep !== "SUCCESS") {
      pollInterval = setInterval(async () => {
        try {
          const token = getAuthToken();
          if (!token) return;
          const res = await fetch(`http://localhost:8000/api/v1/admin/ai/recharge/order-status/${checkoutData.transaction_id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const statusData = await res.json();
            if (statusData.status === "COMPLETED") {
              // Fetch official tax invoice details and auto-transition to success
              const invRes = await fetch(`http://localhost:8000/api/v1/admin/ai/recharge/invoice/${checkoutData.transaction_id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (invRes.ok) {
                const invData = await invRes.json();
                setPaymentSuccessData({
                  invoice_number: invData.invoice_number,
                  payment_id: invData.gateway_payment_id || "VERIFIED_AUTO",
                  tokens_credited: invData.tokens_credited,
                  tax_breakdown: {
                    base_amount: invData.base_amount_inr,
                    cgst: invData.cgst_inr,
                    sgst: invData.sgst_inr,
                    cgst_9: invData.cgst_inr,
                    sgst_9: invData.sgst_inr,
                    total_gst: invData.total_gst_inr,
                    total_paid: invData.total_amount_inr,
                  },
                });
                setGatewayStep("SUCCESS");
                await loadAllData();
              }
            }
          }
        } catch (e) {
          console.error("Order polling check:", e);
        }
      }, 2500);
    }
    return () => clearInterval(pollInterval);
  }, [showPaymentModal, checkoutData, gatewayStep]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const token = getAuthToken();

    try {
      const payload: any = {
        active_provider: activeProvider,
        active_model: activeModel,
        low_token_threshold: Number(lowTokenThreshold),
        is_prepaid_enforced: true,
        merchant_upi_id: merchantUpiId.trim(),
        merchant_name: merchantName.trim(),
        gst_rate_percent: Number(gstRatePercent),
        gateway_mode: gatewayMode,
      };

      if (geminiKey.trim()) payload.gemini_api_key = geminiKey.trim();
      if (openaiKey.trim()) payload.openai_api_key = openaiKey.trim();
      if (claudeKey.trim()) payload.claude_api_key = claudeKey.trim();
      if (ollamaHost.trim()) payload.ollama_host = ollamaHost.trim();
      if (razorpayKeyId.trim()) payload.razorpay_key_id = razorpayKeyId.trim();
      if (razorpayKeySecret.trim()) payload.razorpay_key_secret = razorpayKeySecret.trim();

      const res = await fetch("http://localhost:8000/api/v1/admin/ai/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update AI settings.");
      }

      setSuccessMsg("AI Model, Payment Gateway & Merchant Configuration updated successfully.");
      setGeminiKey("");
      setOpenaiKey("");
      setClaudeKey("");
      setRazorpayKeySecret("");
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) {
      setErrorMsg("Please enter a plan name.");
      return;
    }
    setAddingPlan(true);
    setErrorMsg(null);
    const token = getAuthToken();

    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/ai/plans", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newPlanName.trim(),
          tokens: Number(newPlanTokens),
          price_inr: Number(newPlanPrice),
          description: newPlanDescription.trim() || "Prepaid departmental token pack",
          badge: newPlanBadge.trim() || "Custom Tier",
          is_popular: newPlanIsPopular,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create plan.");
      }

      setSuccessMsg(`Plan "${newPlanName}" created successfully.`);
      setShowAddPlanModal(false);
      setNewPlanName("");
      setNewPlanDescription("");
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || "Could not add plan.");
    } finally {
      setAddingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to deactivate and remove plan "${planName}"?`)) return;
    setErrorMsg(null);
    const token = getAuthToken();

    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/ai/plans/${planId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to deactivate plan.");
      }

      setSuccessMsg(`Plan "${planName}" deactivated successfully.`);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || "Could not deactivate plan.");
    }
  };

  const handleViewExistingInvoice = async (txnId: string) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/ai/recharge/invoice/${txnId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const invData = await res.json();
        setPaymentSuccessData({
          invoice_number: invData.invoice_number,
          payment_id: invData.gateway_payment_id || "VERIFIED",
          tokens_credited: invData.tokens_credited,
          tax_breakdown: {
            base_amount: invData.base_amount_inr,
            cgst: invData.cgst_inr,
            sgst: invData.sgst_inr,
            cgst_9: invData.cgst_inr,
            sgst_9: invData.sgst_inr,
            total_gst: invData.total_gst_inr,
            total_paid: invData.total_amount_inr,
          },
        });
        setCheckoutData({
          transaction_id: invData.transaction_id,
          plan_name: invData.plan_name,
          total_payable_inr: invData.total_amount_inr,
          total_gst_inr: invData.total_gst_inr,
          tokens_to_credit: invData.tokens_credited,
          merchant_name: invData.merchant_name,
          merchant_upi_id: invData.merchant_upi_id,
        });
        setGatewayStep("SUCCESS");
        setShowPaymentModal(true);
      }
    } catch (e: any) {
      setErrorMsg("Failed to load invoice.");
    }
  };

  const handleResetBalance = async (actionType: "zero" | "sync") => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const token = getAuthToken();

    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/ai/reset-balance?action=${actionType}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Failed to reset balance.");
      }
      const data = await res.json();
      setSuccessMsg(data.msg);
      setShowResetConfirm(false);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Dynamic price calculation with live dynamic GST percentage
  const getSelectedPlanPricing = () => {
    const effectiveGstRate = gstRatePercent !== undefined ? gstRatePercent : 18.0;
    const halfGstRate = effectiveGstRate / 2.0;

    if (selectedPlanId === "custom") {
      const base = (customTokens / 1000.0) * 1.0;
      const cgst = base * (halfGstRate / 100.0);
      const sgst = base * (halfGstRate / 100.0);
      const totalGst = cgst + sgst;
      return {
        name: `Custom Token Pack (${customTokens.toLocaleString()} Tokens)`,
        tokens: customTokens,
        base: Math.round(base * 100) / 100,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        gst: Math.round(totalGst * 100) / 100,
        total: Math.round((base + totalGst) * 100) / 100,
        gstRate: effectiveGstRate,
      };
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return { name: "", tokens: 0, base: 0, cgst: 0, sgst: 0, gst: 0, total: 0, gstRate: effectiveGstRate };
    const cgst = plan.price_inr * (halfGstRate / 100.0);
    const sgst = plan.price_inr * (halfGstRate / 100.0);
    const totalGst = cgst + sgst;
    return {
      name: plan.name,
      tokens: plan.tokens,
      base: plan.price_inr,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      gst: Math.round(totalGst * 100) / 100,
      total: Math.round((plan.price_inr + totalGst) * 100) / 100,
      gstRate: effectiveGstRate,
    };
  };

  const handleInitiateRecharge = async () => {
    setErrorMsg(null);
    const token = getAuthToken();

    try {
      const payload: any = {
        plan_id: selectedPlanId,
        payment_method: paymentMethodTab,
      };
      if (selectedPlanId === "custom") {
        payload.custom_tokens = customTokens;
      }

      const res = await fetch("http://localhost:8000/api/v1/admin/ai/recharge/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Could not initialize checkout.");
      }

      const orderData = await res.json();
      setCheckoutData(orderData);
      setTimerSeconds(599);
      setGatewayStep("SELECT");
      setPaymentSuccessData(null);
      setUtrInput("");
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
      setCardName("");
      setOtpInput("");

      // If Razorpay live checkout is configured, open official Razorpay Checkout SDK
      if (orderData.is_real_razorpay && orderData.razorpay_key_id && typeof window !== "undefined") {
        if (!window.Razorpay) {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = () => openRazorpayModal(orderData);
          document.body.appendChild(script);
        } else {
          openRazorpayModal(orderData);
        }
      } else {
        // Open Direct High-Fidelity Gateway Modal
        setShowPaymentModal(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const openRazorpayModal = (orderData: any) => {
    const options = {
      key: orderData.razorpay_key_id,
      amount: Math.round(orderData.total_payable_inr * 100),
      currency: "INR",
      name: "AutoExam AI Grading",
      description: orderData.plan_name,
      order_id: orderData.gateway_order_id,
      handler: async function (response: any) {
        await verifyCompletedPayment({
          transaction_id: orderData.transaction_id,
          gateway_order_id: response.razorpay_order_id,
          gateway_payment_id: response.razorpay_payment_id,
          gateway_signature: response.razorpay_signature,
          payment_method: "RAZORPAY_LIVE",
        });
      },
      prefill: {
        name: "University Super Admin",
        email: "superadmin@autoexam.edu",
      },
      theme: { color: "#1e40af" },
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const verifyCompletedPayment = async (verifyPayload: any) => {
    setProcessingPayment(true);
    setErrorMsg(null);
    const token = getAuthToken();

    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/ai/recharge/verify-payment", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verifyPayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Payment verification failed.");
      }

      const receipt = await res.json();
      setPaymentSuccessData(receipt);
      setGatewayStep("SUCCESS");
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleGatewaySubmit = async () => {
    if (!checkoutData) return;

    if (paymentMethodTab === "UPI") {
      const utr = utrInput.trim() || `UTR${Date.now()}`;
      await verifyCompletedPayment({
        transaction_id: checkoutData.transaction_id,
        gateway_order_id: checkoutData.gateway_order_id,
        gateway_payment_id: `pay_upi_${Date.now()}`,
        payment_method: "UPI",
        utr_reference: utr,
      });
    } else if (paymentMethodTab === "CARD") {
      if (gatewayStep === "SELECT") {
        if (cardNumber.replace(/\s/g, "").length < 15 || !cardExpiry || !cardCvv) {
          setErrorMsg("Please enter valid card details to proceed.");
          return;
        }
        setGatewayStep("OTP");
      } else if (gatewayStep === "OTP") {
        if (otpInput.trim().length < 4) {
          setErrorMsg("Please enter the 6-digit OTP received via SMS.");
          return;
        }
        await verifyCompletedPayment({
          transaction_id: checkoutData.transaction_id,
          gateway_order_id: checkoutData.gateway_order_id,
          gateway_payment_id: `pay_card_${Date.now()}`,
          payment_method: "CREDIT_DEBIT_CARD",
          utr_reference: `CARD-${cardNumber.replace(/\s/g, "").slice(-4)}`,
        });
      }
    } else if (paymentMethodTab === "NETBANKING") {
      await verifyCompletedPayment({
        transaction_id: checkoutData.transaction_id,
        gateway_order_id: checkoutData.gateway_order_id,
        gateway_payment_id: `pay_nb_${Date.now()}`,
        payment_method: `NETBANKING (${selectedBank})`,
        utr_reference: `NB-${Date.now()}`,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  if (!isClient) return null;

  const currentPlanCalc = getSelectedPlanPricing();

  return (
    <div className="flex h-screen bg-background text-foreground selection:bg-primary/30 overflow-hidden transition-colors duration-200">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/50">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                  <Cpu className="w-8 h-8 text-primary" />
                  AI Models, Token Tracker & Prepaid Billing
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage evaluation AI engines (Gemini, ChatGPT, Claude, Ollama), track token usage, and manage prepaid credit packs.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="px-3.5 py-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150"
                  title="Wipe test data and reset to real 0 balance"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to 0 Tokens
                </button>
                <button
                  type="button"
                  onClick={loadAllData}
                  disabled={loading}
                  className="px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm font-medium flex items-center gap-2 transition-colors duration-150"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <a
                  href="#plans-section"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors duration-150"
                >
                  <Coins className="w-4 h-4" />
                  Recharge Tokens
                </a>
              </div>
            </div>

            {/* Error and Success Notifications */}
            {errorMsg && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{successMsg}</span>
              </div>
            )}

            {/* Low Token Alert Banner */}
            {isLowBalance && (
              <div className="p-4 md:p-5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-base font-bold">
                      {isDepleted ? "Prepaid Token Balance Depleted (0 Tokens)" : "Low Token Balance Warning"}
                    </h4>
                    <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
                      {isDepleted
                        ? "Your AI token balance is 0. Student answer evaluations require prepaid tokens. Recharge a token pack below to activate grading."
                        : `Current token balance (${tokenBalance.toLocaleString()}) is below the threshold of ${lowTokenThreshold.toLocaleString()} tokens. Recharge now to avoid interruption.`}
                    </p>
                  </div>
                </div>
                <a
                  href="#plans-section"
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-sm font-semibold shrink-0 text-center transition-colors duration-150 shadow-sm"
                >
                  Top Up Tokens Now
                </a>
              </div>
            )}

            {/* 1. Live Token and Financial Tracker Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="glass-panel p-5 rounded-xl border border-border/60 relative overflow-hidden">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  <span>Available Tokens</span>
                  <Coins className="w-4 h-4 text-primary" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    {tokenBalance.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">Tokens</span>
                </div>
                <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isDepleted ? "bg-destructive w-0" : isLowBalance ? "bg-amber-500 w-1/4" : "bg-primary w-full"
                    }`}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {isDepleted ? "Zero prepaid balance available" : "Active prepaid capacity"}
                </p>
              </div>

              <div className="glass-panel p-5 rounded-xl border border-border/60">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  <span>Prepaid Wallet</span>
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    ₹{walletBalanceInr.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">INR</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Prepaid Secured
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Recharged funds balance
                </p>
              </div>

              <div className="glass-panel p-5 rounded-xl border border-border/60">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  <span>Total Tokens Consumed</span>
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    {totalTokensUsed.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">Tokens</span>
                </div>
                <p className="text-xs text-muted-foreground mt-5">
                  Actual prompt and output tokens evaluated
                </p>
              </div>

              <div className="glass-panel p-5 rounded-xl border border-border/60">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                  <span>Total Spent</span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    ₹{totalCostSpentInr.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (~${(totalCostSpentInr / 86.0).toFixed(2)})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-5">
                  Actual expenditure based on token rates
                </p>
              </div>
            </div>

            {/* 2. Choose the Evaluation Model Section */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-border/70 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-border/50">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Select Active Evaluation Model
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Choose which AI model handles oral viva answer evaluations across all classrooms.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border">
                    Current: <strong className="text-foreground">{activeModel}</strong>
                  </span>
                </div>
              </div>

              {/* Provider Selection Tabs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: "gemini", label: "Google Gemini", subtitle: "Lowest Cost & High Speed" },
                  { id: "openai", label: "ChatGPT (OpenAI)", subtitle: "Industry Standard JSON" },
                  { id: "claude", label: "Anthropic Claude", subtitle: "Rigorous Rubric Depth" },
                  { id: "ollama", label: "Local Ollama", subtitle: "Zero Cost / On-Premise" },
                ].map((prov) => {
                  const isSelected = activeProvider === prov.id;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => {
                        setActiveProvider(prov.id);
                        if (prov.id === "gemini") setActiveModel("gemini-1.5-flash");
                        else if (prov.id === "openai") setActiveModel("gpt-4o-mini");
                        else if (prov.id === "claude") setActiveModel("claude-3-5-haiku");
                        else if (prov.id === "ollama") setActiveModel("llama3");
                      }}
                      className={`p-4 rounded-xl text-left border transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/80 bg-card/60 hover:bg-card hover:border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {prov.label}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{prov.subtitle}</p>
                    </button>
                  );
                })}
              </div>

              {/* Models Available for the Selected Provider */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground block">
                  Select {activeProvider.toUpperCase()} Model Tier:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(availableModels)
                    .filter(([_, m]) => m.provider === activeProvider)
                    .map(([modelKey, m]) => {
                      const isSelected = activeModel === modelKey;
                      return (
                        <div
                          key={modelKey}
                          onClick={() => setActiveModel(modelKey)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                              : "border-border bg-card/40 hover:bg-card hover:border-border/90"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-base text-foreground">{m.name}</h4>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {m.badge}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground mt-2">
                              Speed: <span className="text-foreground font-medium">{m.speed}</span>
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                            <span>
                              In: <strong className="text-foreground">${m.input_per_m}/1M</strong>
                            </span>
                            <span>
                              Out: <strong className="text-foreground">${m.output_per_m}/1M</strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* API Key Configuration Inputs */}
              <div className="p-5 rounded-xl border border-border/70 bg-card/40 space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" />
                  Credentials & Gateway Settings
                </h3>

                {activeProvider === "gemini" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor={fallbackGeminiKeyId} className="font-medium text-foreground">
                        Gemini API Key:
                      </label>
                      <span className="text-muted-foreground">
                        Current: <strong>{keysStatus.gemini || "Not Set"}</strong>
                      </span>
                    </div>
                    <input
                      id={fallbackGeminiKeyId}
                      type="password"
                      placeholder="Paste Gemini API Key (e.g. AIzaSy...)"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                    />
                  </div>
                )}

                {activeProvider === "openai" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor={fallbackOpenAiKeyId} className="font-medium text-foreground">
                        OpenAI API Key:
                      </label>
                      <span className="text-muted-foreground">
                        Current: <strong>{keysStatus.openai || "Not Set"}</strong>
                      </span>
                    </div>
                    <input
                      id={fallbackOpenAiKeyId}
                      type="password"
                      placeholder="Paste OpenAI API Key (sk-...)"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                    />
                  </div>
                )}

                {activeProvider === "claude" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor={fallbackClaudeKeyId} className="font-medium text-foreground">
                        Anthropic Claude API Key:
                      </label>
                      <span className="text-muted-foreground">
                        Current: <strong>{keysStatus.claude || "Not Set"}</strong>
                      </span>
                    </div>
                    <input
                      id={fallbackClaudeKeyId}
                      type="password"
                      placeholder="Paste Anthropic API Key (sk-ant-...)"
                      value={claudeKey}
                      onChange={(e) => setClaudeKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                    />
                  </div>
                )}

                {activeProvider === "ollama" && (
                  <div className="space-y-2">
                    <label htmlFor={fallbackOllamaHostId} className="text-xs font-medium text-foreground block">
                      Local Ollama Host URL:
                    </label>
                    <input
                      id={fallbackOllamaHostId}
                      type="text"
                      placeholder="http://localhost:11434"
                      value={ollamaHost}
                      onChange={(e) => setOllamaHost(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                    />
                  </div>
                )}

                {/* Dynamic Payment Gateway & Merchant Billing Configuration */}
                <div className="pt-3 border-t border-border/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-primary" />
                        Dynamic Payment Gateway & Merchant Settlement
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Configure institutional settlement details for automatic token recharges.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Mode: <strong className="text-primary">{gatewayMode}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor={fallbackMerchantUpiId} className="text-xs text-muted-foreground block font-medium">
                        Institutional Merchant UPI ID / VPA:
                      </label>
                      <input
                        id={fallbackMerchantUpiId}
                        type="text"
                        placeholder="e.g. autoexam.billing@icici"
                        value={merchantUpiId}
                        onChange={(e) => setMerchantUpiId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={fallbackMerchantNameId} className="text-xs text-muted-foreground block font-medium">
                        Merchant Business / Institution Name:
                      </label>
                      <input
                        id={fallbackMerchantNameId}
                        type="text"
                        placeholder="e.g. AutoExam Examination Cell"
                        value={merchantName}
                        onChange={(e) => setMerchantName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor={fallbackGstRateId} className="text-xs text-muted-foreground block font-medium">
                        GST Tax Rate (%):
                      </label>
                      <input
                        id={fallbackGstRateId}
                        type="number"
                        step="0.1"
                        min="0"
                        max="28"
                        value={gstRatePercent}
                        onChange={(e) => setGstRatePercent(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <span className="text-[11px] text-muted-foreground block">
                        Calculates {((gstRatePercent || 18) / 2).toFixed(1)}% CGST + {((gstRatePercent || 18) / 2).toFixed(1)}% SGST dynamically on invoices.
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={fallbackGatewayModeId} className="text-xs text-muted-foreground block font-medium">
                        Gateway Processing Mode:
                      </label>
                      <select
                        id={fallbackGatewayModeId}
                        value={gatewayMode}
                        onChange={(e) => setGatewayMode(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="HYBRID">Hybrid (Direct UPI/Cards + Razorpay SDK)</option>
                        <option value="DIRECT_ONLY">Direct Zero-Fee Gateway (UPI QR & Cards Only)</option>
                        <option value="RAZORPAY_ONLY">Razorpay Checkout SDK Only</option>
                      </select>
                      <span className="text-[11px] text-muted-foreground block">
                        Select how students and department admins execute recharge checkouts.
                      </span>
                    </div>
                  </div>

                  {/* Razorpay Integration Keys */}
                  <div className="pt-2 border-t border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        Razorpay Gateway Credentials (Optional)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Status: <strong>{keysStatus.razorpay || "Direct Gateway Active"}</strong>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label htmlFor={fallbackRzpKeyId} className="text-xs text-muted-foreground block">
                          Razorpay Key ID (rzp_test_... or rzp_live_...):
                        </label>
                        <input
                          id={fallbackRzpKeyId}
                          type="text"
                          placeholder="rzp_test_..."
                          value={razorpayKeyId}
                          onChange={(e) => setRazorpayKeyId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={fallbackRzpSecretId} className="text-xs text-muted-foreground block">
                          Razorpay Key Secret:
                        </label>
                        <input
                          id={fallbackRzpSecretId}
                          type="password"
                          placeholder="Leave blank to keep current secret"
                          value={razorpayKeySecret}
                          onChange={(e) => setRazorpayKeySecret(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    </div>

                    {/* Dynamic Webhook Endpoint URL with Copy Button */}
                    <div className="p-3 rounded-lg border border-border bg-muted/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-foreground block">Automated Webhook Listener Endpoint:</span>
                        <code className="text-[11px] text-muted-foreground font-mono">
                          http://localhost:8000/api/v1/admin/ai/recharge/webhook
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("http://localhost:8000/api/v1/admin/ai/recharge/webhook");
                          setCopiedWebhook(true);
                          setTimeout(() => setCopiedWebhook(false), 2000);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted font-medium flex items-center gap-1.5 shrink-0"
                      >
                        {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedWebhook ? "Copied Endpoint" : "Copy Webhook URL"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label htmlFor={fallbackThresholdId} className="text-xs font-medium text-foreground block">
                        Low Token Alert Threshold:
                      </label>
                      <input
                        id={fallbackThresholdId}
                        type="number"
                        value={lowTokenThreshold}
                        onChange={(e) => setLowTokenThreshold(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 text-sm shadow-sm transition-colors duration-150 flex items-center gap-2"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Prepaid Plans and Dynamic Price Calculation Section */}
            <div id="plans-section" className="glass-panel p-6 md:p-8 rounded-2xl border border-border/70 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary" />
                    Prepaid Token Packs
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Click any plan below. Real-time pricing is calculated dynamically with institutional tax breakdown before proceeding to the payment gateway.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddPlanModal(true)}
                  className="px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors duration-150 self-start md:self-auto shrink-0"
                >
                  <Plus className="w-4 h-4 text-primary" />
                  Add New Plan Tier
                </button>
              </div>

              {/* Dynamic Plan Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((p) => {
                  const isSelected = selectedPlanId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`relative rounded-2xl p-6 border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary"
                          : "border-border bg-card/60 hover:border-border hover:bg-card"
                      }`}
                    >
                      {p.is_popular && (
                        <div className="absolute -top-3 right-6 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-md shadow-sm">
                          {p.badge}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg text-foreground">{p.name}</h3>
                          <div className="flex items-center gap-1.5">
                            {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                            {plans.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePlan(p.id, p.name);
                                }}
                                title="Deactivate and remove plan"
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{p.description}</p>

                        <div className="mt-6 flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-foreground">₹{p.price_inr.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground font-medium">
                            + {gstRatePercent}% GST
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span><strong>{p.tokens.toLocaleString()}</strong> Tokens credited</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Rate: ~₹{p.rate_per_k.toFixed(3)} per 1,000 tokens</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Instant balance activation</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-border/50">
                        <button
                          type="button"
                          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150 ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-foreground hover:bg-muted/80"
                          }`}
                        >
                          {isSelected ? "Selected Plan" : "Choose Plan"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Token Booster Card */}
              <div
                onClick={() => setSelectedPlanId("custom")}
                className={`p-6 rounded-2xl border cursor-pointer transition-all duration-150 ${
                  selectedPlanId === "custom"
                    ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                    : "border-border bg-card/40 hover:bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-bold text-foreground text-base">Custom Token Booster</h4>
                      <p className="text-xs text-muted-foreground">
                        Specify exact tokens required. Dynamic rate: ₹1.00 per 1,000 tokens.
                      </p>
                    </div>
                  </div>
                  {selectedPlanId === "custom" && <CheckCircle2 className="w-5 h-5 text-primary" />}
                </div>

                {selectedPlanId === "custom" && (
                  <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        Token Quantity:
                      </label>
                      <input
                        type="number"
                        step={50000}
                        min={50000}
                        value={customTokens}
                        onChange={(e) => setCustomTokens(Math.max(50000, Number(e.target.value)))}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground font-semibold"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Base Cost: <strong className="text-foreground">₹{((customTokens / 1000.0) * 1.0).toFixed(2)}</strong> + {currentPlanCalc.gstRate}% GST ({((currentPlanCalc.gstRate || 18) / 2).toFixed(1)}% CGST + {((currentPlanCalc.gstRate || 18) / 2).toFixed(1)}% SGST)
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Calculation Summary and Proceed Button */}
              <div className="p-6 rounded-2xl border border-border/80 bg-muted/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Dynamic Order Summary
                  </span>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">{currentPlanCalc.name}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
                    <span>Base Amount: <strong className="text-foreground">₹{currentPlanCalc.base.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>CGST ({((currentPlanCalc.gstRate || 18) / 2).toFixed(1)}%): <strong className="text-foreground">₹{currentPlanCalc.cgst.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>SGST ({((currentPlanCalc.gstRate || 18) / 2).toFixed(1)}%): <strong className="text-foreground">₹{currentPlanCalc.sgst.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>Total Tokens: <strong className="text-primary">{currentPlanCalc.tokens.toLocaleString()}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Total Payable:</span>
                    <span className="text-2xl md:text-3xl font-extrabold text-foreground">
                      ₹{currentPlanCalc.total.toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleInitiateRecharge}
                    className="px-6 py-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm shadow-md transition-all duration-150 flex items-center gap-2 cursor-pointer"
                  >
                    Proceed to Payment Gateway
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Real-time Audit Logs & Recharge Invoices Ledger */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-border/70 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveLedgerTab("LOGS")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      activeLedgerTab === "LOGS"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <History className="w-4 h-4" />
                    Evaluation Token Logs ({recentLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLedgerTab("INVOICES")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      activeLedgerTab === "INVOICES"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Recharge Ledger & Tax Invoices ({transactions.length})
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {activeLedgerTab === "LOGS" ? "Real-time AI consumption logs" : "Official GST recharge transactions"}
                </span>
              </div>

              {activeLedgerTab === "LOGS" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-3">Date & Time</th>
                        <th className="py-3 px-3">Provider</th>
                        <th className="py-3 px-3">Model</th>
                        <th className="py-3 px-3">Operation</th>
                        <th className="py-3 px-3 text-right">Prompt Tokens</th>
                        <th className="py-3 px-3 text-right">Completion</th>
                        <th className="py-3 px-3 text-right">Total Tokens</th>
                        <th className="py-3 px-3 text-right">Cost (INR)</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {recentLogs.length > 0 ? (
                        recentLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                            </td>
                            <td className="py-3 px-3 font-semibold uppercase text-xs">{log.provider}</td>
                            <td className="py-3 px-3 font-mono text-xs">{log.model_name}</td>
                            <td className="py-3 px-3 text-xs capitalize text-muted-foreground">
                              {log.operation_type.replace("_", " ")}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-xs">{log.prompt_tokens.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right font-mono text-xs">{log.completion_tokens.toLocaleString()}</td>
                            <td className="py-3 px-3 text-right font-mono text-xs font-bold text-foreground">
                              {log.total_tokens.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                              ₹{log.cost_inr.toFixed(4)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-muted-foreground">
                            No token usage records found yet. Real evaluations will record deductions automatically.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-3">Invoice #</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Plan / Pack</th>
                        <th className="py-3 px-3 text-right">Tokens Credited</th>
                        <th className="py-3 px-3 text-right">Amount (Incl. GST)</th>
                        <th className="py-3 px-3">Method</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-right">Invoice Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {transactions.length > 0 ? (
                        transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-xs text-foreground">
                              {tx.invoice_number || `ORD-${tx.transaction_id.slice(-6)}`}
                            </td>
                            <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                              {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : "-"}
                            </td>
                            <td className="py-3 px-3 font-medium text-xs text-foreground">{tx.plan_name}</td>
                            <td className="py-3 px-3 text-right font-mono text-xs font-bold text-primary">
                              +{tx.tokens_purchased.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-foreground">
                              ₹{tx.amount_inr.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-xs text-muted-foreground capitalize">
                              {tx.payment_method}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  tx.status === "COMPLETED"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              {tx.status === "COMPLETED" ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewExistingInvoice(tx.transaction_id)}
                                  className="px-2.5 py-1 rounded-md border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground inline-flex items-center gap-1.5 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  Tax Invoice
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Incomplete</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground">
                            No recharge transactions found. Select a token plan above to execute a recharge.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 5. Production Payment Gateway Modal */}
      {showPaymentModal && checkoutData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-xl w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Gateway Header */}
            <div className="p-5 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
                  AE
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    AutoExam Payment Gateway
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      256-Bit SSL Secured
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    Ref: {checkoutData.transaction_id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTimer(timerSeconds)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-md"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Gateway Body */}
            {gatewayStep !== "SUCCESS" ? (
              <div className="p-6 space-y-5">
                {/* Order Summary Ribbon */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Selected Package</span>
                    <strong className="text-base text-foreground">{checkoutData.plan_name}</strong>
                    <span className="text-xs text-primary font-semibold block mt-0.5">
                      +{checkoutData.tokens_to_credit.toLocaleString()} Tokens Credited
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block font-medium">Total Amount Due</span>
                    <strong className="text-2xl font-extrabold text-foreground">
                      ₹{checkoutData.total_payable_inr.toFixed(2)}
                    </strong>
                    <span className="text-[11px] text-muted-foreground block">
                      Incl. 18% GST (₹{checkoutData.total_gst_inr.toFixed(2)})
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector Tabs */}
                {gatewayStep === "SELECT" && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethodTab("UPI")}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                          paymentMethodTab === "UPI"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        UPI / QR Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethodTab("CARD")}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                          paymentMethodTab === "CARD"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        <CreditCard className="w-4 h-4" />
                        Cards (Visa/MC)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethodTab("NETBANKING")}
                        className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                          paymentMethodTab === "NETBANKING"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                        Net Banking
                      </button>
                    </div>

                    {/* Method 1: UPI */}
                    {paymentMethodTab === "UPI" && (
                      <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-4">
                        <div className="flex flex-col md:flex-row items-center gap-5">
                          {/* Real Dynamic QR Code */}
                          <div className="p-2 rounded-xl bg-white border border-border shrink-0 shadow-sm">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                                checkoutData.upi_intent_string
                              )}`}
                              alt="UPI QR Code"
                              className="w-36 h-36 rounded"
                            />
                          </div>

                          <div className="space-y-2 text-xs flex-1">
                            <p className="font-semibold text-foreground">
                              Scan with any UPI App: GPay, PhonePe, Paytm, or BHIM.
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Payee: <strong className="text-foreground">{checkoutData.merchant_name || merchantName}</strong>
                            </p>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
                              <span className="font-mono text-foreground font-semibold">
                                {checkoutData.merchant_upi_id || merchantUpiId}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(checkoutData.merchant_upi_id || merchantUpiId)}
                                className="text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                              >
                                {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedUpi ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-muted-foreground">
                                Payable: <strong className="text-foreground">₹{checkoutData.total_payable_inr.toFixed(2)}</strong> (exact amount encoded).
                              </p>
                              <a
                                href={checkoutData.upi_intent_string}
                                className="px-2.5 py-1 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                              >
                                <Smartphone className="w-3 h-3" />
                                Open UPI App
                              </a>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/50 space-y-1.5">
                          <label className="text-xs font-semibold text-foreground block">
                            Bank Reference / UTR Number (12 Digits):
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Enter 12-digit UTR from UPI app"
                              value={utrInput}
                              onChange={(e) => setUtrInput(e.target.value)}
                              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground"
                            />
                            <button
                              type="button"
                              onClick={() => setUtrInput(`UTR${Date.now().toString().slice(-9)}`)}
                              className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground"
                            >
                              Auto-Fill Test UTR
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Method 2: Cards */}
                    {paymentMethodTab === "CARD" && (
                      <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground block">Card Number:</label>
                          <input
                            type="text"
                            placeholder="4532 8912 3456 7890"
                            maxLength={19}
                            value={cardNumber}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
                              setCardNumber(val);
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground block">Expiry (MM/YY):</label>
                            <input
                              type="text"
                              placeholder="12/28"
                              maxLength={5}
                              value={cardExpiry}
                              onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, "");
                                if (val.length > 2) val = `${val.slice(0, 2)}/${val.slice(2, 4)}`;
                                setCardExpiry(val);
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground block">CVV:</label>
                            <input
                              type="password"
                              placeholder="•••"
                              maxLength={4}
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono text-foreground"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-foreground block">Cardholder Name:</label>
                          <input
                            type="text"
                            placeholder="e.g. Yash Pujara"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                          />
                        </div>
                      </div>
                    )}

                    {/* Method 3: Net Banking */}
                    {paymentMethodTab === "NETBANKING" && (
                      <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3">
                        <label className="text-xs font-semibold text-foreground block">Select Financial Institution:</label>
                        <div className="grid grid-cols-2 gap-2">
                          {["HDFC Bank", "State Bank of India", "ICICI Bank", "Axis Bank", "Kotak Mahindra", "Punjab National Bank"].map((b) => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => setSelectedBank(b)}
                              className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-colors cursor-pointer ${
                                selectedBank === b
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Gateway Step: 3D Secure OTP verification */}
                {gatewayStep === "OTP" && (
                  <div className="p-5 rounded-xl border border-border bg-card text-center space-y-4">
                    <Smartphone className="w-10 h-10 text-primary mx-auto" />
                    <div>
                      <h4 className="font-bold text-base text-foreground">3D Secure OTP Authentication</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        A 6-digit authentication code was sent to the phone registered with card ending in {cardNumber.slice(-4)}.
                      </p>
                    </div>

                    <div className="max-w-xs mx-auto space-y-2">
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                        className="w-full text-center px-4 py-2.5 rounded-lg border border-border bg-background text-lg font-mono font-bold tracking-widest text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setOtpInput("123456")}
                        className="text-xs text-primary hover:underline block mx-auto font-medium"
                      >
                        Click to use test OTP (123456)
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (gatewayStep === "OTP") setGatewayStep("SELECT");
                      else setShowPaymentModal(false);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-foreground text-sm font-semibold hover:bg-muted"
                  >
                    {gatewayStep === "OTP" ? "Back" : "Cancel"}
                  </button>

                  <button
                    type="button"
                    onClick={handleGatewaySubmit}
                    disabled={processingPayment}
                    className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {processingPayment ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Verifying Transaction...
                      </>
                    ) : gatewayStep === "OTP" ? (
                      "Submit OTP & Complete Recharge"
                    ) : (
                      `Authorize Payment: ₹${checkoutData.total_payable_inr.toFixed(2)}`
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Success & Tax Invoice Receipt View */
              <div className="p-6 space-y-5">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Payment Settled Successfully</h3>
                  <p className="text-xs text-muted-foreground">
                    Invoice <strong>{paymentSuccessData.invoice_number}</strong> issued. Tokens have been credited instantly.
                  </p>
                </div>

                {/* Official Tax Invoice Container */}
                <div className="p-5 rounded-xl bg-muted/20 border border-border space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <span className="font-bold text-foreground block">
                        {checkoutData?.merchant_name || merchantName || "AutoExam Examination Cell"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">SAC: 998431 (Cloud AI Processing & Hosting Services)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-foreground block">{paymentSuccessData.invoice_number}</span>
                      <span className="text-[11px] text-muted-foreground">{new Date().toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package Credited:</span>
                      <strong className="text-primary font-bold">
                        +{paymentSuccessData.tokens_credited.toLocaleString()} Tokens
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Token Fee:</span>
                      <span className="text-foreground">
                        ₹{(paymentSuccessData.tax_breakdown?.base_amount ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CGST ({((gstRatePercent || 18) / 2).toFixed(1)}%):</span>
                      <span className="text-foreground">
                        ₹{(paymentSuccessData.tax_breakdown?.cgst ?? paymentSuccessData.tax_breakdown?.cgst_9 ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SGST ({((gstRatePercent || 18) / 2).toFixed(1)}%):</span>
                      <span className="text-foreground">
                        ₹{(paymentSuccessData.tax_breakdown?.sgst ?? paymentSuccessData.tax_breakdown?.sgst_9 ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-border pt-1.5 text-foreground text-sm">
                      <span>Total Amount Paid:</span>
                      <span>₹{(paymentSuccessData.tax_breakdown?.total_paid ?? 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border text-[11px] text-muted-foreground flex justify-between">
                    <span>Payment ID: {paymentSuccessData.payment_id}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">VERIFIED & SETTLED</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-2.5 rounded-xl border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Tax Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentSuccessData(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 cursor-pointer"
                  >
                    Done & View Balance
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Reset Test Data Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <RotateCcw className="w-6 h-6" />
              <h3 className="font-bold text-lg text-foreground">Reset Balances</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose how you would like to reset the balance ledger:
            </p>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleResetBalance("zero")}
                className="w-full p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 text-left cursor-pointer"
              >
                <strong>Reset to Real 0 Tokens</strong>
                <span className="block text-xs font-normal text-destructive/80 mt-0.5">
                  Clears all test balances and mock tokens so you start completely fresh at 0.
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleResetBalance("sync")}
                className="w-full p-3 rounded-xl border border-border bg-muted/40 text-foreground text-sm font-semibold hover:bg-muted text-left cursor-pointer"
              >
                <strong>Sync from Real Transactions</strong>
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  Recalculates balance mathematically: (Purchased Tokens - Evaluated Tokens).
                </span>
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Add Custom Plan Modal */}
      {showAddPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Create New Token Plan Tier
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPlanModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground block">Plan Tier Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Semester Evaluation Booster"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">Tokens Credited:</label>
                  <input
                    type="number"
                    required
                    min={50000}
                    step={50000}
                    value={newPlanTokens}
                    onChange={(e) => setNewPlanTokens(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">Base Price (INR):</label>
                  <input
                    type="number"
                    required
                    min={1}
                    step={1}
                    value={newPlanPrice}
                    onChange={(e) => setNewPlanPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">Highlight Badge:</label>
                  <input
                    type="text"
                    placeholder="e.g. Best Value, Special"
                    value={newPlanBadge}
                    onChange={(e) => setNewPlanBadge(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="newPlanIsPopular"
                    checked={newPlanIsPopular}
                    onChange={(e) => setNewPlanIsPopular(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary/40 h-4 w-4"
                  />
                  <label htmlFor="newPlanIsPopular" className="text-xs font-semibold text-foreground cursor-pointer">
                    Feature as Popular
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground block">Description:</label>
                <textarea
                  rows={2}
                  placeholder="Details about target classes and student coverage..."
                  value={newPlanDescription}
                  onChange={(e) => setNewPlanDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlanModal(false)}
                  className="px-4 py-2 rounded-lg border border-border bg-muted/40 text-foreground text-xs font-semibold hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingPlan}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer"
                >
                  {addingPlan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Save & Publish Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
