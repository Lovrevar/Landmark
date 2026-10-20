import { createContext, useContext } from 'react'

/**
 * Whether the site tree hides completed and terminated contracts (DEFECT_BACKLOG SUP-4).
 *
 * Only the contract cards are hidden: the tree is still built from every contract, so group and
 * project totals keep counting closed ones. A context because the flag is read four levels down,
 * in the leaf TreeGroup, and the components in between have no use for it.
 */
export const HideClosedContractsContext = createContext(false)

export const useHideClosedContracts = () => useContext(HideClosedContractsContext)
