export type JoinState = 'none' | 'pending' | 'member';

// German label for the team-join action depending on the user's current state.
export function joinButtonLabel(state: JoinState): string {
  switch (state) {
    case 'pending': return 'Anfrage ausstehend';
    case 'member':  return 'Mitglied';
    case 'none':    return 'Beitritt anfragen';
  }
}
