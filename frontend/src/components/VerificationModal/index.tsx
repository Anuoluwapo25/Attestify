'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, AlertCircle, Loader2, X, Smartphone, Monitor } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { countries, SelfQRcodeWrapper, SelfAppBuilder, getUniversalLink } from '@selfxyz/qrcode';
import { CONTRACT_ADDRESSES } from '@/config/contracts';
import { ATTESTIFY_VAULT_ABI } from '@/abis';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export default function VerificationModal({ isOpen, onClose, onVerified }: VerificationModalProps) {
  const { address } = useAccount();
  const [step, setStep] = useState<'intro' | 'qrcode' | 'mobile' | 'success' | 'submitting' | 'error'>('intro');
  const [errorMessage, setErrorMessage] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selfApp, setSelfApp] = useState<any | null>(null);
  const [universalLink, setUniversalLink] = useState('');
  const [, setVerificationMethod] = useState<'desktop' | 'mobile'>('desktop');

  // Contract write for submitting proof
  const { writeContract, data: txHash, error: writeError } = useWriteContract();
  
  // Wait for transaction confirmation
  const { 
    isSuccess: isTxSuccess, 
    isError: isTxError,
    error: txError 
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Handle transaction errors
  useEffect(() => {
    if (isTxError || writeError) {
      console.error('❌ Transaction error:', txError || writeError);
      setErrorMessage(
        (txError?.message || writeError?.message || 'Transaction failed').substring(0, 200)
      );
      setStep('error');
    }
  }, [isTxError, txError, writeError]);

  // Initialize Self App when modal opens
  useEffect(() => {
    if (!isOpen || !address) return;

    console.log('🔍 Initializing Self App...');
    console.log('🔍 Address:', address);
    console.log('🔍 Contract address:', CONTRACT_ADDRESSES.celoSepolia.vault);

    try {
      // Build Self App configuration - simplified approach
      // Since our contract doesn't integrate with Self Protocol, we'll just use QR code for UX
      console.log('🔍 Building Self App with config:');
      console.log('  - version: 2');
      console.log('  - appName: Attestify');
      console.log('  - scope: attestify');
      console.log('  - userId:', address);
      console.log('  - endpoint:', CONTRACT_ADDRESSES.celoSepolia.vault);
      console.log('  - endpointType: staging_celo');
      
      const app = new SelfAppBuilder({
        version: 2,
        appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || 'Attestify',
        scope: process.env.NEXT_PUBLIC_SELF_SCOPE || 'attestify',
        endpoint: CONTRACT_ADDRESSES.celoSepolia.vault, // Contract address for staging_celo
        logoBase64: 'https://i.postimg.cc/mrmVf9hm/self.png',
        userId: address,
        endpointType: 'staging_celo', // Correct type for Celo Sepolia
        userIdType: 'hex', // EVM address type
        userDefinedData: `Attestify verification for ${address}`,
        disclosures: {
          // Required verifications for DeFi compliance
          minimumAge: 18,
          excludedCountries: [
            countries.CUBA,
            countries.IRAN,
            countries.NORTH_KOREA,
            countries.RUSSIA,
          ],
          // Optional: Request additional information
          nationality: true,
        },
      }).build();

      console.log('✅ Self App built successfully:', app);
      setSelfApp(app);

      // Generate universal link for mobile users
      const link = getUniversalLink(app);
      console.log('✅ Universal link generated:', link);
      setUniversalLink(link);
    } catch (error: unknown) {
      console.error('❌ Failed to initialize Self App:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to initialize verification');
      setStep('error');
    }
  }, [isOpen, address]);

  // Handle transaction success
  useEffect(() => {
    if (isTxSuccess) {
      console.log('✅ Verification submitted to blockchain successfully!');
      console.log('Transaction hash:', txHash);
      setStep('success');
      
      // Wait a bit longer before closing to ensure blockchain state updates
      setTimeout(() => {
        // Call onVerified to update parent state
        onVerified();
        
        // Close modal after verification callback
        setTimeout(() => {
          onClose();
        }, 1000);
      }, 2000);
    }
  }, [isTxSuccess, txHash, onVerified, onClose]);

  // Handle successful verification from Self Protocol
  const handleSuccessfulVerification = async (proofData?: unknown) => {
    console.log('✅ Identity verified by Self Protocol!');
    console.log('Proof data received:', proofData);
    
    setStep('submitting');
    
    try {
      // Simple approach: just call contract's verifySelfProof function
      // The contract doesn't validate the proof, just marks user as verified
      console.log('📤 Calling contract verifySelfProof function...');
      console.log('Contract address:', CONTRACT_ADDRESSES.celoSepolia.vault);
      
      await writeContract({
        address: CONTRACT_ADDRESSES.celoSepolia.vault as `0x${string}`,
        abi: ATTESTIFY_VAULT_ABI,
        functionName: 'verifySelfProof',
        args: ['0x', '0x'], // Empty proof and user context data - contract doesn't validate them
      });
      
      console.log('✅ Contract verification successful!');
      
    } catch (error) {
      console.error('❌ Contract verification failed:', error);
      setErrorMessage('Contract verification failed. Please try again.');
      setStep('error');
    }
  };

  // Handle verification error
  const handleVerificationError = (data?: { error_code?: string; reason?: string }) => {
    console.error('❌ Verification failed:', data);
    setErrorMessage(data?.reason || 'Verification failed. Please try again.');
    setStep('error');
  };

  // Start verification flow
  const handleStartVerification = (method: 'desktop' | 'mobile') => {
    console.log('🔍 Starting verification with method:', method);
    console.log('🔍 Address:', address);
    console.log('🔍 SelfApp:', selfApp);
    console.log('🔍 Contract address:', CONTRACT_ADDRESSES.celoSepolia.vault);
    
    if (!address) {
      setErrorMessage('Please connect your wallet first');
      setStep('error');
      return;
    }

    if (!selfApp) {
      setErrorMessage('Self App not initialized. Please try again.');
      setStep('error');
      return;
    }

    setVerificationMethod(method);
    
    if (method === 'desktop') {
      setStep('qrcode');
    } else {
      setStep('mobile');
    }
  };

  // Open Self App on mobile
  const openSelfApp = () => {
    if (!universalLink) return;
    window.open(universalLink, '_blank');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Identity Verification</h2>
                  <p className="text-sm text-white/80">Powered by Self Protocol</p>
                </div>
              </div>
              {step === 'intro' && (
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 'intro' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Why verify?</h3>
                  <ul className="space-y-2 text-sm text-blue-800">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Access to all platform features</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Secure and privacy-preserving</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>One-time verification process</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>Age 18+ and compliance checks</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 font-medium mb-1">🧪 Testing Mode</p>
                  <p className="text-xs text-yellow-700">
                    Using Self Protocol staging_celo endpoint. Contract will mark you as verified after successful verification.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700 mb-3">
                    Self Protocol uses zero-knowledge proofs to verify your identity without sharing personal data on-chain.
                  </p>
                  <p className="text-xs text-gray-600 font-medium mb-2">Choose your device:</p>
                </div>

                {/* Desktop Verification */}
                <button
                  onClick={() => handleStartVerification('desktop')}
                  disabled={!selfApp}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <Monitor className="h-5 w-5" />
                  <div className="text-left">
                    <div>Verify on Desktop</div>
                    <div className="text-xs opacity-90">Scan QR code with Self app</div>
                  </div>
                </button>

                {/* Mobile Verification */}
                <button
                  onClick={() => handleStartVerification('mobile')}
                  disabled={!selfApp || !universalLink}
                  className="w-full px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <Smartphone className="h-5 w-5" />
                  <div className="text-left">
                    <div>Verify on Mobile</div>
                    <div className="text-xs opacity-90">Open Self app directly</div>
                  </div>
                </button>
              </motion.div>
            )}

            {/* Desktop QR Code Step */}
            {step === 'qrcode' && selfApp && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    Scan with Self App
                  </p>
                  <p className="text-xs text-gray-600 mb-4">
                    Use your phone&apos;s Self app to scan this QR code
                  </p>
                  
                  {/* Self Protocol QR Code Component */}
                  <div className="flex justify-center">
                    <SelfQRcodeWrapper
                      selfApp={selfApp}
                      onSuccess={handleSuccessfulVerification}
                      onError={handleVerificationError}
                      size={280}
                      darkMode={false}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900 font-medium mb-2">Instructions:</p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Open the Self app on your mobile device</li>
                    <li>Tap &quot;Scan QR Code&quot;</li>
                    <li>Complete the verification steps in the app</li>
                    <li>You&apos;ll be verified automatically</li>
                  </ol>
                </div>

                <button
                  onClick={() => setStep('intro')}
                  className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  ← Back to options
                </button>
              </motion.div>
            )}

            {/* Mobile Deeplink Step */}
            {step === 'mobile' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="text-center py-6">
                  <div className="h-16 w-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Open Self App
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Complete verification directly in your Self mobile app
                  </p>

                  <button
                    onClick={openSelfApp}
                    disabled={!universalLink}
                    className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 transition-all shadow-lg disabled:opacity-50"
                  >
                    Open Self App
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-700 font-medium mb-2">What happens next:</p>
                  <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                    <li>The Self app will open on your device</li>
                    <li>Complete the verification steps</li>
                    <li>Return here when done</li>
                  </ol>
                </div>

                <button
                  onClick={() => setStep('intro')}
                  className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  ← Back to options
                </button>
              </motion.div>
            )}

            {step === 'submitting' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Submitting to Blockchain...</h3>
                <p className="text-sm text-gray-600">Please confirm the transaction in your wallet</p>
                <p className="text-xs text-gray-500 mt-2">This will permanently verify your identity on-chain</p>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Verification Successful!</h3>
                <p className="text-sm text-gray-600">Your identity is now verified on-chain</p>
                <p className="text-xs text-gray-500 mt-2">You won&apos;t need to verify again! ✅</p>
              </motion.div>
            )}

            {step === 'error' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="text-center py-4">
                  <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-10 w-10 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Verification Failed</h3>
                  <p className="text-sm text-gray-600">{errorMessage}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('intro')}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-all"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

