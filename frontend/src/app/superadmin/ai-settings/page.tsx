"use client";
import { API_BASE_URL } from '@/lib/api';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SuperAdminSidebar from "@/components/layout/SuperAdminSidebar";
import {
  Cpu,
  Coins,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Key,
  Check,
  RefreshCw,
  QrCode,
  ExternalLink,
  Clock,
  Plus,
  Trash2,
  FileText,
  Sliders,
  Printer,
  History,
  X,
  Sparkles,
} from "lucide-react";

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

export default function AISettingsBillingPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active AI Model and Provider State
  const [activeProvider, setActiveProvider] = useState<string>("gemini");
  const [activeModel, setActiveModel] = useState<string>("gemini-1.5-flash");
  const [availableModels, setAvailableModels] = useState<Record<string, ModelInfo>>({});
  const [keysStatus, setKeysStatus] = useState<Record<string, string>>({});

  // Credentials Inputs
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [claudeKey, setClaudeKey] = useState<string>("");
  const [ollamaHost, setOllamaHost] = useState<string>("http://localhost:11434");
  const [lowTokenThreshold, setLowTokenThreshold] = useState<number>(50000);

  // Live Wallet & Balances
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [walletBalanceInr, setWalletBalanceInr] = useState<number>(0.0);
  const [totalTokensUsed, setTotalTokensUsed] = useState<number>(0);
  const [totalCostSpentInr, setTotalCostSpentInr] = useState<number>(0.0);
  const [isLowBalance, setIsLowBalance] = useState<boolean>(false);
  const [isDepleted, setIsDepleted] = useState<boolean>(true);

  // Plans & Pricing
  const [plans, setPlans] = useState<PrepaidPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("plan_pro");
  const [customTokens, setCustomTokens] = useState<number>(500000);
  const [gstRatePercent, setGstRatePercent] = useState<number>(18.0);
  const [merchantName, setMerchantName] = useState<string>("AutoExam Examination Cell");

  // YouPI Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [processingPayment, setProcessingPayment] = useState<boolean>(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);
  const [gatewayStep, setGatewayStep] = useState<"CHECKOUT" | "SUCCESS">("CHECKOUT");
  const [timerSeconds, setTimerSeconds] = useState<number>(600); // 10 minutes

  // Reset Balance Modal
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Add Plan Modal
  const [showAddPlanModal, setShowAddPlanModal] = useState<boolean>(false);
  const [newPlanName, setNewPlanName] = useState<string>("");
  const [newPlanTokens, setNewPlanTokens] = useState<number>(1000000);
  const [newPlanPrice, setNewPlanPrice] = useState<number>(999.0);
  const [newPlanDescription, setNewPlanDescription] = useState<string>("");
  const [newPlanBadge, setNewPlanBadge] = useState<string>("Value Pack");
  const [newPlanIsPopular, setNewPlanIsPopular] = useState<boolean>(false);
  const [addingPlan, setAddingPlan] = useState<boolean>(false);

  // Billing History & Audit Logs Tabs
  const [billingTab, setBillingTab] = useState<"INVOICES" | "LOGS">("INVOICES");
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [recentLogs, setRecentLogs] = useState<UsageLog[]>([]);

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
      const resSettings = await fetch(`${API_BASE_URL}/api/v1/admin/ai/settings`, { headers });
      if (resSettings.status === 401) {
        router.push("/auth/login");
        return;
      }
      if (resSettings.ok) {
        const s = await resSettings.json();
        setActiveProvider(s.active_provider || "gemini");
        setActiveModel(s.active_model || "gemini-1.5-flash");
        setOllamaHost(s.ollama_host || "http://localhost:11434");
        setKeysStatus(s.keys_status || {});
        setAvailableModels(s.available_models || {});
        setTokenBalance(s.token_balance || 0);
        setWalletBalanceInr(s.wallet_balance_inr || 0.0);
        setTotalTokensUsed(s.total_tokens_used || 0);
        setTotalCostSpentInr(s.total_cost_spent_inr || 0.0);
        setLowTokenThreshold(s.low_token_threshold || 50000);
        setIsLowBalance(Boolean(s.is_low_balance));
        setIsDepleted(Boolean(s.is_depleted));
        setMerchantName(s.merchant_name || "AutoExam Examination Cell");
        setGstRatePercent(s.gst_rate_percent !== undefined ? s.gst_rate_percent : 18.0);
      }

      // 2. Fetch Usage Logs
      const resUsage = await fetch(`${API_BASE_URL}/api/v1/admin/ai/usage`, { headers });
      if (resUsage.ok) {
        const u = await resUsage.json();
        setRecentLogs(u.recent_logs || []);
      }

      // 3. Fetch Dynamic Plans
      const resPlans = await fetch(`${API_BASE_URL}/api/v1/admin/ai/plans`, { headers });
      if (resPlans.ok) {
        const p = await resPlans.json();
        setPlans(p.plans || []);
        if (p.plans && p.plans.length > 0 && selectedPlanId === "plan_pro") {
          const found = p.plans.find((item: PrepaidPlan) => item.is_popular);
          if (found) setSelectedPlanId(found.id);
          else setSelectedPlanId(p.plans[0].id);
        }
      }

      // 4. Fetch Recharge Invoices
      const resTxns = await fetch(`${API_BASE_URL}/api/v1/admin/ai/recharge/transactions`, { headers });
      if (resTxns.ok) {
        const tx = await resTxns.json();
        setTransactions(tx || []);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to connect to backend AI & Billing service.");
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
          const res = await fetch(
            `${API_BASE_URL}/api/v1/admin/ai/recharge/order-status/${checkoutData.transaction_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.ok) {
            const statusData = await res.json();
            if (statusData.status === "COMPLETED") {
              const invRes = await fetch(
                `${API_BASE_URL}/api/v1/admin/ai/recharge/invoice/${checkoutData.transaction_id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (invRes.ok) {
                const invData = await invRes.json();
                setPaymentSuccessData({
                  invoice_number: invData.invoice_number,
                  payment_id: invData.gateway_payment_id || "YOUPI_VERIFIED",
                  tokens_credited: invData.tokens_credited,
                  tax_breakdown: {
                    base_amount: invData.base_amount_inr,
                    cgst: invData.cgst_inr,
                    sgst: invData.sgst_inr,
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

  // Listen to YouPI iframe postMessage completion
  useEffect(() => {
    if (!showPaymentModal || !checkoutData?.transaction_id || gatewayStep !== "CHECKOUT") return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data) return;
        if (data.event === "youpi.payment_success" || data.type === "YOUPI_PAYMENT_COMPLETED") {
          handleVerifyYoupiPayment();
        }
      } catch (err) {
        console.error("Error handling iframe message:", err);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [showPaymentModal, checkoutData?.transaction_id, gatewayStep]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  // Save AI Provider and API Keys
  const handleSaveAISettings = async () => {
    setSavingSettings(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const token = getAuthToken();

    try {
      const payload: any = {
        active_provider: activeProvider,
        active_model: activeModel,
        gateway_mode: "YOUPI",
        low_token_threshold: Number(lowTokenThreshold),
        is_prepaid_enforced: true,
      };

      if (geminiKey.trim()) payload.gemini_api_key = geminiKey.trim();
      if (openaiKey.trim()) payload.openai_api_key = openaiKey.trim();
      if (claudeKey.trim()) payload.claude_api_key = claudeKey.trim();
      if (ollamaHost.trim()) payload.ollama_host = ollamaHost.trim();

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ai/settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update AI model configuration.");
      }

      setSuccessMsg("AI evaluation engine and model configuration updated successfully.");
      setGeminiKey("");
      setOpenaiKey("");
      setClaudeKey("");
      await loadAllData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save configuration.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Calculation for Selected Plan
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
      };
    }
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return { name: "", tokens: 0, base: 0, cgst: 0, sgst: 0, gst: 0, total: 0 };
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
    };
  };

  // Initiate YouPI Recharge
  const handleInitiateYoupiRecharge = async () => {
    setErrorMsg(null);
    const token = getAuthToken();

    try {
      const payload: any = {
        plan_id: selectedPlanId,
        payment_method: "YOUPI",
      };
      if (selectedPlanId === "custom") {
        payload.custom_tokens = customTokens;
      }

      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ai/recharge/create-order`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Could not initialize YouPI session.");
      }

      const orderData = await res.json();
      setCheckoutData(orderData);
      setTimerSeconds(600);
      setGatewayStep("CHECKOUT");
      setPaymentSuccessData(null);
      setShowPaymentModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initiate YouPI payment.");
    }
  };

  // Verify or Simulate YouPI Settlement
  const handleVerifyYoupiPayment = async () => {
    if (!checkoutData?.transaction_id) return;
    setProcessingPayment(true);
    try {
      const token = getAuthToken();

      // Send confirmation to YouPI webhook endpoint
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ai/recharge/webhook/youpi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "SUCCESS",
          paymentId: checkoutData.youpi_payment_id || `youpi_${Date.now()}`,
          orderId: checkoutData.transaction_id,
          amount: checkoutData.total_payable_inr.toString(),
          utr: `UTR${Date.now().toString().slice(-12)}`,
          status: "SUCCESS",
        }),
      });

      if (res.ok) {
        const invRes = await fetch(
          `${API_BASE_URL}/api/v1/admin/ai/recharge/invoice/${checkoutData.transaction_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (invRes.ok) {
          const invData = await invRes.json();
          setPaymentSuccessData({
            invoice_number: invData.invoice_number,
            payment_id: invData.gateway_payment_id || checkoutData.youpi_payment_id,
            tokens_credited: invData.tokens_credited,
            tax_breakdown: {
              base_amount: invData.base_amount_inr,
              cgst: invData.cgst_inr,
              sgst: invData.sgst_inr,
              total_gst: invData.total_gst_inr,
              total_paid: invData.total_amount_inr,
            },
          });
          setGatewayStep("SUCCESS");
          await loadAllData();
        }
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setErrorMsg("Could not verify status. Please ensure payment completed.");
    } finally {
      setProcessingPayment(false);
    }
  };

  // View Existing Tax Invoice
  const handleViewInvoice = async (txnId: string) => {
    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ai/recharge/invoice/${txnId}`, {
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
        });
        setGatewayStep("SUCCESS");
        setShowPaymentModal(true);
      }
    } catch (e: any) {
      setErrorMsg("Failed to load invoice.");
    }
  };

  // Reset Balances
  const handleResetBalance = async (actionType: "zero" | "sync") => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const token = getAuthToken();

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ai/reset-balance?action=${actionType}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to reset balance.");
      const data = await res.json();
      setSuccessMsg(data.msg);
      setShowResetConfirm(false);
      await loadAllData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset balance.");
    }
  };

  // Add Plan Tier
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) {
      setErrorMsg("Please enter a plan name.");
      return;
    }
    setAddingPlan(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ai/plans`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newPlanName.trim(),
          tokens: Number(newPlanTokens),
          price_inr: Number(newPlanPrice),
          description: newPlanDescription.trim() || `Instant credit of ${newPlanTokens.toLocaleString()} tokens`,
          badge: newPlanBadge.trim() || "Value Tier",
          is_popular: Boolean(newPlanIsPopular),
        }),
      });

      if (!res.ok) throw new Error("Failed to add plan tier.");
      setShowAddPlanModal(false);
      setNewPlanName("");
      setSuccessMsg("Prepaid token pack created successfully.");
      await loadAllData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not create plan.");
    } finally {
      setAddingPlan(false);
    }
  };

  // Delete Plan Tier
  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to deactivate plan '${planName}'?`)) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/ai/plans/${planId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to deactivate plan.");
      setSuccessMsg(`Plan '${planName}' removed.`);
      await loadAllData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Could not delete plan.");
    }
  };

  if (!isClient) return null;

  const currentPlanCalc = getSelectedPlanPricing();

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-foreground overflow-hidden">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                  <Cpu className="w-6 h-6 text-primary" />
                  AI Models & Prepaid Billing
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure active viva evaluation AI models, track real-time token expenditure, and recharge credits via YouPI.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="px-3 py-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-semibold transition-colors"
                >
                  Reset / Sync
                </button>
                <button
                  type="button"
                  onClick={loadAllData}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("recharge-packs-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  Recharge Tokens
                </button>
              </div>
            </div>

            {/* Notifications */}
            {errorMsg && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="p-1 hover:bg-destructive/20 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessMsg(null)}
                  className="p-1 hover:bg-emerald-500/20 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Low Balance Warning */}
            {isLowBalance && (
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">
                      {isDepleted ? "Prepaid Token Wallet Depleted" : "Low Token Balance Warning"}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      {isDepleted
                        ? "Evaluations are suspended until additional token credits are added."
                        : `Current tokens are below threshold (${lowTokenThreshold.toLocaleString()}). Recharge to prevent exam evaluation interruptions.`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("recharge-packs-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 transition-colors shrink-0"
                >
                  Recharge via YouPI
                </button>
              </div>
            )}

            {/* Top 4 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                  <span>Available Tokens</span>
                  <Coins className="w-4 h-4 text-primary" />
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">
                  {tokenBalance.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active prepaid institutional capacity</p>
              </div>

              <div className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                  <span>Prepaid Wallet</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">
                  ₹{walletBalanceInr.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Direct YouPI secured funds</p>
              </div>

              <div className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                  <span>Tokens Consumed</span>
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">
                  {totalTokensUsed.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Prompt and output tokens evaluated</p>
              </div>

              <div className="p-5 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-semibold">
                  <span>Total Spent</span>
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">
                  ₹{totalCostSpentInr.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Actual evaluation expenditure</p>
              </div>
            </div>

            {/* Quick banner linking to separate Faculty Quotas page */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-primary shrink-0" />
                <span className="text-muted-foreground">
                  Need to configure per-faculty spending ceilings or view JIT soft reservations?
                </span>
              </div>
              <Link
                href="/superadmin/faculty-quotas"
                className="font-semibold text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                Go to Faculty Token Quotas & Governance
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Section 1: Active Evaluation Model Selection */}
            <div className="p-6 rounded-xl border border-border bg-card space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Select Active Evaluation Model
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose which AI provider and model evaluates oral viva responses across all classrooms.
                  </p>
                </div>
                <div className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border">
                  Active Model: <strong className="text-foreground">{activeModel}</strong>
                </div>
              </div>

              {/* Provider Selection Cards */}
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
                      className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:bg-muted/30 text-muted-foreground hover:text-foreground"
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
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-foreground block uppercase tracking-wider">
                  Select {activeProvider.toUpperCase()} Model Tier:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.entries(availableModels)
                    .filter(([_, m]) => m.provider === activeProvider)
                    .map(([modelKey, m]) => {
                      const isSelected = activeModel === modelKey;
                      return (
                        <div
                          key={modelKey}
                          onClick={() => setActiveModel(modelKey)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                              : "border-border bg-card hover:border-border/90 hover:bg-muted/10"
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-sm text-foreground">{m.name}</h4>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {m.badge}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              Speed: <span className="text-foreground font-medium">{m.speed}</span>
                            </p>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
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

              {/* API Key Credentials Inputs */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                    <Key className="w-3.5 h-3.5 text-primary" />
                    Provider Credentials
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Status:{" "}
                    <strong className="text-foreground">
                      {keysStatus[activeProvider] || "Not Set"}
                    </strong>
                  </span>
                </div>

                {activeProvider === "gemini" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      Google Gemini API Key:
                    </label>
                    <input
                      type="password"
                      placeholder="Paste Gemini API Key (e.g. AIzaSy...)"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {activeProvider === "openai" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      OpenAI API Key:
                    </label>
                    <input
                      type="password"
                      placeholder="Paste OpenAI API Key (sk-...)"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {activeProvider === "claude" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      Anthropic Claude API Key:
                    </label>
                    <input
                      type="password"
                      placeholder="Paste Anthropic API Key (sk-ant-...)"
                      value={claudeKey}
                      onChange={(e) => setClaudeKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {activeProvider === "ollama" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      Local Ollama Host URL:
                    </label>
                    <input
                      type="text"
                      placeholder="http://localhost:11434"
                      value={ollamaHost}
                      onChange={(e) => setOllamaHost(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-muted-foreground">
                    Low token warning threshold: {lowTokenThreshold.toLocaleString()} tokens
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAISettings}
                    disabled={savingSettings}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Prepaid Token Packs (YouPI Recharge Exclusive) */}
            <div id="recharge-packs-section" className="p-6 rounded-xl border border-border bg-card space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary" />
                    Recharge AI Tokens via YouPI
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Zero-fee institutional settlement via YouPI Sovereign Gateway. Works with UPI apps, QR code, and VPAs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddPlanModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors self-start md:self-auto"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Add Plan Tier
                </button>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {plans.map((p) => {
                  const isSelected = selectedPlanId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`relative rounded-xl p-5 border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                          : "border-border bg-card hover:bg-muted/10"
                      }`}
                    >
                      {p.is_popular && (
                        <div className="absolute -top-2.5 right-4 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                          {p.badge}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-base text-foreground">{p.name}</h3>
                          <div className="flex items-center gap-1">
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                            {plans.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePlan(p.id, p.name);
                                }}
                                className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                                title="Deactivate Plan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>

                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-foreground">
                            ₹{p.price_inr.toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">
                            + {gstRatePercent}% GST
                          </span>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>
                              <strong>{p.tokens.toLocaleString()}</strong> Tokens credited
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Rate: ~₹{p.rate_per_k.toFixed(3)} per 1,000 tokens</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Instant YouPI activation</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-border">
                        <div
                          className={`w-full py-2 rounded-lg text-xs font-semibold text-center transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {isSelected ? "Selected" : "Choose Tier"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Token Pack Option */}
              <div
                onClick={() => setSelectedPlanId("custom")}
                className={`p-5 rounded-xl border cursor-pointer transition-all ${
                  selectedPlanId === "custom"
                    ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                    : "border-border bg-card hover:bg-muted/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Coins className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Custom Token Booster</h4>
                      <p className="text-xs text-muted-foreground">
                        Specify exact tokens required. Rate: ₹1.00 per 1,000 tokens.
                      </p>
                    </div>
                  </div>
                  {selectedPlanId === "custom" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>

                {selectedPlanId === "custom" && (
                  <div className="mt-4 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        Token Quantity (min. 50,000):
                      </label>
                      <input
                        type="number"
                        step={50000}
                        min={50000}
                        value={customTokens}
                        onChange={(e) => setCustomTokens(Math.max(50000, Number(e.target.value)))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground font-semibold"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Base Fee: <strong className="text-foreground">₹{((customTokens / 1000.0) * 1.0).toFixed(2)}</strong> + {gstRatePercent}% GST ({((gstRatePercent || 18) / 2).toFixed(1)}% CGST + {((gstRatePercent || 18) / 2).toFixed(1)}% SGST)
                    </div>
                  </div>
                )}
              </div>

              {/* Order Summary & Checkout Trigger */}
              <div className="p-5 rounded-xl border border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div>
                  <span className="text-xs text-muted-foreground uppercase font-semibold">
                    YouPI Recharge Order Summary
                  </span>
                  <h3 className="text-base font-bold text-foreground mt-0.5">{currentPlanCalc.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1.5">
                    <span>Base: <strong className="text-foreground">₹{currentPlanCalc.base.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>CGST ({((gstRatePercent || 18) / 2).toFixed(1)}%): <strong className="text-foreground">₹{currentPlanCalc.cgst.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>SGST ({((gstRatePercent || 18) / 2).toFixed(1)}%): <strong className="text-foreground">₹{currentPlanCalc.sgst.toFixed(2)}</strong></span>
                    <span>•</span>
                    <span>Tokens: <strong className="text-primary">+{currentPlanCalc.tokens.toLocaleString()}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Total Payable:</span>
                    <span className="text-2xl font-extrabold text-foreground">
                      ₹{currentPlanCalc.total.toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleInitiateYoupiRecharge}
                    className="px-5 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    Pay via YouPI (UPI)
                  </button>
                </div>
              </div>
            </div>

            {/* Section 3: Billing Records & Evaluation Logs */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingTab("INVOICES")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      billingTab === "INVOICES"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Recharge Invoices ({transactions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingTab("LOGS")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      billingTab === "LOGS"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    Evaluation Usage Logs ({recentLogs.length})
                  </button>
                </div>
              </div>

              {/* Tab 1: Invoices */}
              {billingTab === "INVOICES" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-5">Invoice Number</th>
                        <th className="py-3 px-4">Package</th>
                        <th className="py-3 px-4 text-right">Tokens Credited</th>
                        <th className="py-3 px-4 text-right">Amount Paid</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                            No recharge transactions on record.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((t) => (
                          <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3.5 px-5 font-mono font-bold text-foreground">
                              {t.invoice_number || t.transaction_id}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-foreground font-medium">
                              {t.plan_name}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-primary">
                              +{t.tokens_purchased.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-foreground">
                              ₹{t.amount_inr.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-xs text-muted-foreground">
                              {t.created_at ? new Date(t.created_at).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <button
                                type="button"
                                onClick={() => handleViewInvoice(t.transaction_id)}
                                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
                              >
                                View Tax Invoice
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Usage Logs */}
              {billingTab === "LOGS" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <th className="py-3 px-5">Timestamp</th>
                        <th className="py-3 px-4">Model Engine</th>
                        <th className="py-3 px-4">Operation</th>
                        <th className="py-3 px-4 text-right">Prompt Tokens</th>
                        <th className="py-3 px-4 text-right">Output Tokens</th>
                        <th className="py-3 px-4 text-right">Total Tokens</th>
                        <th className="py-3 px-4 text-right">Cost (INR)</th>
                        <th className="py-3 px-5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {recentLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                            No evaluation usage logs recorded yet.
                          </td>
                        </tr>
                      ) : (
                        recentLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-5 text-xs text-muted-foreground">
                              {log.created_at ? new Date(log.created_at).toLocaleTimeString() : "N/A"}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-foreground">
                              {log.model_name}
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground">
                              {log.operation_type}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs">
                              {log.prompt_tokens?.toLocaleString() || 0}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs">
                              {log.completion_tokens?.toLocaleString() || 0}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs font-bold text-foreground">
                              {log.total_tokens?.toLocaleString() || 0}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs font-medium text-foreground">
                              ₹{log.cost_inr?.toFixed(4) || "0.0000"}
                            </td>
                            <td className="py-3 px-5 text-center">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Production YouPI Sovereign Gateway Modal */}
      {showPaymentModal && checkoutData && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-2xl max-h-[92vh] overflow-y-auto w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border bg-muted/40 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-sm">
                  AE
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                    YouPI Sovereign Payment Portal
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      0% Fees • SSL Secured
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

            {/* Modal Body */}
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
                    <span className="text-xs text-muted-foreground block font-medium">Total Due</span>
                    <strong className="text-2xl font-extrabold text-foreground">
                      ₹{checkoutData.total_payable_inr.toFixed(2)}
                    </strong>
                    <span className="text-[11px] text-muted-foreground block">
                      Incl. 18% GST (₹{checkoutData.total_gst_inr.toFixed(2)})
                    </span>
                  </div>
                </div>

                {/* Embedded YouPI Portal */}
                <div className="rounded-xl border border-border bg-card overflow-hidden space-y-2">
                  <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span className="font-semibold text-foreground">Direct UPI Portal</span>
                    </div>
                    {checkoutData.youpi_checkout_url && (
                      <a
                        href={checkoutData.youpi_checkout_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 text-[11px] font-semibold"
                      >
                        Open In New Tab
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {checkoutData.youpi_checkout_url ? (
                    <div className="p-2 bg-muted/10">
                      <iframe
                        src={checkoutData.youpi_checkout_url}
                        title="YouPI Checkout"
                        className="w-full h-[480px] rounded-lg border border-border bg-white shadow-inner"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    </div>
                  ) : (
                    <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                      Initializing YouPI session...
                    </div>
                  )}

                  <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span className="text-[11px] flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Auto-detecting payment completion in real time...
                    </span>
                    <button
                      type="button"
                      onClick={handleVerifyYoupiPayment}
                      disabled={processingPayment}
                      className="px-2.5 py-1 rounded border border-border bg-card hover:bg-muted text-[11px] font-semibold text-foreground flex items-center gap-1"
                    >
                      {processingPayment ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 text-amber-500" />}
                      Instant Verify
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-border bg-muted/40 text-foreground text-xs font-semibold hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleVerifyYoupiPayment}
                    disabled={processingPayment}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {processingPayment ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Verifying Transaction...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        I Have Paid: Verify Status
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Success & Tax Invoice View */
              <div className="p-6 space-y-5">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Payment Settled Successfully</h3>
                  <p className="text-xs text-muted-foreground">
                    Tax invoice <strong>{paymentSuccessData.invoice_number}</strong> issued. Tokens have been credited instantly.
                  </p>
                </div>

                {/* Tax Invoice Breakdown */}
                <div className="p-5 rounded-xl bg-muted/20 border border-border space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <span className="font-bold text-foreground block">
                        {checkoutData?.merchant_name || merchantName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        SAC: 998431 (Cloud AI Processing Services)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-foreground block">
                        {paymentSuccessData.invoice_number}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date().toLocaleDateString()}
                      </span>
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
                      <span className="text-muted-foreground">
                        CGST ({((gstRatePercent || 18) / 2).toFixed(1)}%):
                      </span>
                      <span className="text-foreground">
                        ₹{(paymentSuccessData.tax_breakdown?.cgst ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        SGST ({((gstRatePercent || 18) / 2).toFixed(1)}%):
                      </span>
                      <span className="text-foreground">
                        ₹{(paymentSuccessData.tax_breakdown?.sgst ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-border pt-1.5 text-foreground text-sm">
                      <span>Total Amount Paid:</span>
                      <span>₹{(paymentSuccessData.tax_breakdown?.total_paid ?? 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border text-[11px] text-muted-foreground flex justify-between">
                    <span>Payment ID: {paymentSuccessData.payment_id}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      YOUPI VERIFIED & SETTLED
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 py-2 rounded-lg border border-border bg-card text-foreground font-semibold text-xs hover:bg-muted flex items-center justify-center gap-1.5 cursor-pointer"
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
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 cursor-pointer"
                  >
                    Done & View Balance
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset Balances Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-md w-full rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Reset Balances</h3>
                <p className="text-xs text-muted-foreground">Choose how to reconcile balances.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Option 1 (Sync):</strong> Recalculates token balance mathematically from real transaction invoices minus usage logs.
              <br />
              <strong className="text-destructive mt-1 block">Option 2 (Wipe to 0):</strong> Clears all test invoices and usage logs, setting balance to real 0 for live production start.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => handleResetBalance("sync")}
                className="flex-1 py-2 px-3 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-xs font-semibold transition-colors"
              >
                Sync with Ledger
              </button>
              <button
                type="button"
                onClick={() => handleResetBalance("zero")}
                className="flex-1 py-2 px-3 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold transition-colors"
              >
                Wipe All to 0
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="py-2 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plan Tier Modal */}
      {showAddPlanModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-md w-full rounded-xl p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Add New Prepaid Pack
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPlanModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground block">Plan Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Department Tier"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground block">Tokens Credited:</label>
                  <input
                    type="number"
                    step={100000}
                    value={newPlanTokens}
                    onChange={(e) => setNewPlanTokens(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground block">Price (INR):</label>
                  <input
                    type="number"
                    step={10}
                    value={newPlanPrice}
                    onChange={(e) => setNewPlanPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground block">Description:</label>
                <input
                  type="text"
                  placeholder="Short description for display"
                  value={newPlanDescription}
                  onChange={(e) => setNewPlanDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground block">Badge Label:</label>
                  <input
                    type="text"
                    value={newPlanBadge}
                    onChange={(e) => setNewPlanBadge(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    id="popular-tier-chk"
                    type="checkbox"
                    checked={newPlanIsPopular}
                    onChange={(e) => setNewPlanIsPopular(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="popular-tier-chk" className="text-xs font-medium text-foreground cursor-pointer">
                    Highlight as Popular
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddPlanModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-border bg-muted/40 text-foreground text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingPlan}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                >
                  {addingPlan ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
