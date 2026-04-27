/** Matches Convex `operatorRole` literals. */

export type HoaOperatorRole
  = | 'boardMember'
    | 'homeOwner'
    | 'managementCompany'

export function operatorRoleDisplayLabel(role: HoaOperatorRole): string {
  const labels: Record<HoaOperatorRole, string> = {

    boardMember: 'Board member',
    homeOwner: 'Home owner',
    managementCompany: 'Management company'
  }

  return labels[role]
}
