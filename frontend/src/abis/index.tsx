import VaultABI from './Vault.json';
import { CONTRACT_ADDRESSES as CONFIG_ADDRESSES } from '@/config/contracts';

// Import ABI from JSON file
export const ATTESTIFY_VAULT_ABI = VaultABI.abi;

// Re-export contract addresses for backward compatibility
// Use the centralized config from @/config/contracts
export const CONTRACT_ADDRESSES = {
  ATTESTIFY_VAULT: CONFIG_ADDRESSES.celoSepolia.vault as `0x${string}`,
  CUSD_TOKEN: CONFIG_ADDRESSES.celoSepolia.cUSD as `0x${string}`,
} as const;

// Self Protocol Config ID
export const SELF_PROTOCOL_CONFIG_ID = "0x986751c577aa5cfaef6f49fa2a46fa273b04e1bf78250966b8037dccf8afd399";

// ERC20 Token ABI (for cUSD approval and balance checks)
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  }
] as const;

// Contract configuration
export const CONTRACT_CONFIG = {
  address: CONTRACT_ADDRESSES.ATTESTIFY_VAULT,
  abi: ATTESTIFY_VAULT_ABI,
} as const;

// cUSD Token configuration
export const CUSD_CONFIG = {
  address: CONTRACT_ADDRESSES.CUSD_TOKEN,
  abi: ERC20_ABI,
} as const;

// Strategy types enum
export const STRATEGY_TYPES = {
  CONSERVATIVE: 0,
  BALANCED: 1,
  GROWTH: 2,
} as const;

// Strategy names mapping
export const STRATEGY_NAMES = {
  [STRATEGY_TYPES.CONSERVATIVE]: 'Conservative',
  [STRATEGY_TYPES.BALANCED]: 'Balanced',
  [STRATEGY_TYPES.GROWTH]: 'Growth',
} as const;
