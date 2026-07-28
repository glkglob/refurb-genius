/**
 * Deal Copilot presentation barrel (AO-1J1).
 *
 * Stable import surface for mutation / QueryClient ownership hooks and shared
 * deal chat query keys. Does not export QueryClient or raw cache mutators.
 */
export { dealChatKeys } from "../query/dealChatKeys";
export { useInvalidateDealMessages } from "./hooks/useInvalidateDealMessages";
export {
  useCreateDealThread,
  type CreateDealThreadInput,
  type UseCreateDealThreadOptions,
} from "./hooks/useCreateDealThread";
export {
  useSendDealChatMessage,
  type UseSendDealChatMessageOptions,
} from "./hooks/useSendDealChatMessage";
