// path: apps/web/src/components/MpesaModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  WORKSPACE_PLANS,
  WorkspacePlanType,
  formatKES,
  isValidKenyanPhone,
} from '@sketchboard/shared';
import { useCanvasStore } from '../store/useCanvasStore';
import { MpesaService } from '../services/mpesa-service';

export interface MpesaModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  userId: string;
}

type CheckoutStep = 'select' | 'waiting' | 'success' | 'failed';

export const MpesaModal: React.FC<MpesaModalProps> = ({
  isOpen,
  onClose,
  boardId,
  userId,
}) => {
  const { locale, t } = useCanvasStore();
  const [selectedPlan, setSelectedPlan] = useState<WorkspacePlanType>('daily_pass');
  const [phone, setPhone] = useState('0712345678');
  const [step, setStep] = useState<CheckoutStep>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [mpesaReceipt, setMpesaReceipt] = useState<string | null>(null);
  const [pollAttempt, setPollAttempt] = useState(0);

  const isPollingCancelledRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      isPollingCancelledRef.current = true;
      setStep('select');
      setIsLoading(false);
      setErrorMessage(null);
      setCheckoutRequestId(null);
      setMpesaReceipt(null);
      setPollAttempt(0);
    } else {
      isPollingCancelledRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activePlanMetadata = WORKSPACE_PLANS[selectedPlan];
  const isPhoneValid = isValidKenyanPhone(phone);

  const handleInitiatePayment = async () => {
    if (!isPhoneValid) {
      setErrorMessage(t.mpesaModal.invalidPhoneError);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await MpesaService.initiateStkPush({
        phone,
        planType: selectedPlan,
        boardId,
        userId,
      });

      setCheckoutRequestId(res.CheckoutRequestID);
      setStep('waiting');
      setIsLoading(false);

      // Begin polling
      startPolling(res.CheckoutRequestID);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Failed to initiate STK Push payment.');
    }
  };

  const startPolling = async (reqId: string) => {
    try {
      const queryResult = await MpesaService.pollUntilComplete(reqId, {
        intervalMs: 2000,
        maxAttempts: 30,
        onAttempt: (attempt) => {
          if (!isPollingCancelledRef.current) {
            setPollAttempt(attempt);
          }
        },
      });

      if (isPollingCancelledRef.current) return;

      setMpesaReceipt(queryResult.mpesaReceiptNumber || 'NLX' + Math.random().toString(36).substring(2, 9).toUpperCase());
      setStep('success');
    } catch (err: any) {
      if (isPollingCancelledRef.current) return;
      setErrorMessage(err?.message || 'Transaction did not complete.');
      setStep('failed');
    }
  };

  const handleSimulate = async (success: boolean) => {
    if (!checkoutRequestId) return;
    try {
      await MpesaService.simulateCallback(checkoutRequestId, success);
    } catch (err: any) {
      console.warn('Simulation notice:', err?.message);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading && step !== 'waiting') {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.4)',
              }}
            >
              <Smartphone size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                  {t.mpesaModal.title}
                </h2>
                <span
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.05em',
                  }}
                >
                  {t.mpesaModal.badge}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#94a3b8' }}>
                {t.mpesaModal.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 6,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, maxHeight: 'calc(85vh - 70px)', overflowY: 'auto' }}>
          {step === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Plan Cards */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>
                  {t.mpesaModal.selectPlan}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(Object.keys(WORKSPACE_PLANS) as WorkspacePlanType[]).map((planKey) => {
                    const plan = WORKSPACE_PLANS[planKey];
                    const isSelected = selectedPlan === planKey;
                    const planTitle = locale === 'sw' ? plan.nameSw : plan.name;
                    const planDesc = locale === 'sw' ? plan.descriptionSw : plan.description;

                    return (
                      <div
                        key={planKey}
                        onClick={() => setSelectedPlan(planKey)}
                        style={{
                          border: isSelected ? '2px solid #22c55e' : '1px solid #334155',
                          borderRadius: 12,
                          padding: 12,
                          backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.08)' : '#1e293b',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          position: 'relative',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              backgroundColor: '#22c55e',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                            }}
                          >
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', paddingRight: isSelected ? 20 : 0 }}>
                            {planTitle}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e', margin: '4px 0' }}>
                            {formatKES(plan.amountKes)}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>
                            {planDesc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phone Input */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                  {t.mpesaModal.phoneLabel}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.trim())}
                    placeholder={t.mpesaModal.phonePlaceholder}
                    data-testid="mpesa-phone-input"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      backgroundColor: '#1e293b',
                      border: isPhoneValid ? '1px solid #334155' : '1px solid #ef4444',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: '#ffffff',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  {isPhoneValid && (
                    <div style={{ position: 'absolute', right: 12, top: 12, color: '#22c55e' }}>
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: 11, color: isPhoneValid ? '#94a3b8' : '#ef4444' }}>
                  {isPhoneValid ? t.mpesaModal.phoneHelp : t.mpesaModal.invalidPhoneError}
                </p>
              </div>

              {/* Central Bank of Kenya regulatory note */}
              <div
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: '#94a3b8',
                }}
              >
                <ShieldCheck size={16} color="#38bdf8" />
                <span>{t.mpesaModal.cbkLimitNote}</span>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: '#fca5a5',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    color: '#cbd5e1',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.exportModal.cancel}
                </button>
                <button
                  onClick={handleInitiatePayment}
                  disabled={isLoading || !isPhoneValid}
                  data-testid="mpesa-pay-button"
                  style={{
                    flex: 2,
                    padding: '10px 16px',
                    background: isLoading || !isPhoneValid ? '#334155' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: isLoading || !isPhoneValid ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: isLoading || !isPhoneValid ? 'none' : '0 4px 12px rgba(22, 163, 74, 0.4)',
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t.mpesaModal.initiatingButton}</span>
                    </>
                  ) : (
                    <>
                      <span>{t.mpesaModal.payButton}</span>
                      <span style={{ opacity: 0.9 }}>({formatKES(activePlanMetadata.amountKes)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'waiting' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px 8px' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '2px solid #22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#22c55e',
                  marginBottom: 16,
                }}
              >
                <Smartphone size={32} />
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: '#ffffff' }}>
                {t.mpesaModal.promptTitle}
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5, maxWidth: 420 }}>
                {t.mpesaModal.promptInstruction}
              </p>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: 10,
                  padding: '12px 20px',
                  border: '1px solid #334155',
                  marginBottom: 20,
                  display: 'flex',
                  gap: 20,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: '#94a3b8' }}>{t.mpesaModal.phoneSentLabel}: </span>
                  <span style={{ fontWeight: 700, color: '#ffffff' }}>{phone}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>{t.mpesaModal.amountPaidLabel}: </span>
                  <span style={{ fontWeight: 700, color: '#22c55e' }}>{formatKES(activePlanMetadata.amountKes)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38bdf8', fontSize: 12, marginBottom: 24 }}>
                <Loader2 size={16} className="animate-spin" />
                <span>{t.mpesaModal.waitingForPin} ({pollAttempt}/30)</span>
              </div>

              {/* Mock Simulation Buttons (Developer / Offline Testing Convenience) */}
              <div
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  border: '1px dashed #475569',
                  borderRadius: 10,
                  padding: 12,
                  marginTop: 10,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#cbd5e1', marginBottom: 8 }}>
                  Mock Environment Simulator (Zero Credentials)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleSimulate(true)}
                    data-testid="mpesa-simulate-success"
                    style={{
                      flex: 1,
                      backgroundColor: '#16a34a',
                      border: 'none',
                      borderRadius: 6,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '8px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    {t.mpesaModal.simulateSuccess}
                  </button>
                  <button
                    onClick={() => handleSimulate(false)}
                    data-testid="mpesa-simulate-cancel"
                    style={{
                      flex: 1,
                      backgroundColor: '#dc2626',
                      border: 'none',
                      borderRadius: 6,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '8px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    {t.mpesaModal.simulateCancel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px 8px' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '2px solid #22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#22c55e',
                  marginBottom: 16,
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 700, color: '#ffffff' }}>
                {t.mpesaModal.successTitle}
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#94a3b8' }}>
                {t.mpesaModal.successSubtitle}
              </p>

              <div
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: '#1e293b',
                  borderRadius: 10,
                  border: '1px solid #334155',
                  padding: 16,
                  marginBottom: 18,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: 8 }}>
                  <span style={{ color: '#94a3b8' }}>{t.mpesaModal.receiptLabel}:</span>
                  <span style={{ fontWeight: 800, color: '#22c55e', fontFamily: 'monospace', fontSize: 14 }}>
                    {mpesaReceipt}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>{t.mpesaModal.planLabel}:</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>
                    {locale === 'sw' ? activePlanMetadata.nameSw : activePlanMetadata.name}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>{t.mpesaModal.amountPaidLabel}:</span>
                  <span style={{ fontWeight: 700, color: '#ffffff' }}>{formatKES(activePlanMetadata.amountKes)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>{t.mpesaModal.phoneSentLabel}:</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{phone}</span>
                </div>
              </div>

              <p style={{ margin: '0 0 18px 0', fontSize: 11, color: '#38bdf8' }}>
                ✓ {t.mpesaModal.smsNotice}
              </p>

              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t.mpesaModal.doneButton}
              </button>
            </div>
          )}

          {step === 'failed' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '16px 8px' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '2px solid #ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={36} />
              </div>

              <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 700, color: '#ffffff' }}>
                {t.mpesaModal.failedTitle}
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#fca5a5' }}>
                {errorMessage || 'The payment request was not completed.'}
              </p>

              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    color: '#cbd5e1',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.mpesaModal.closeButton}
                </button>
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    setStep('select');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <RotateCcw size={14} />
                  <span>{t.mpesaModal.tryAgainButton}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

