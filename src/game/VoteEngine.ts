import type { VoteRecord, VoteResult } from '../types';

export class VoteEngine {
  private votes: VoteRecord[] = [];
  private voteWeights: Map<string, number>;
  private revoteCount = 0;
  private readonly maxRevotes: number;
  private readonly tieDeath: 'random' | 'no_execute' | 'all_execute';

  constructor(
    voteWeights: Map<string, number>,
    maxRevotes: number,
    tieDeath: 'random' | 'no_execute' | 'all_execute'
  ) {
    this.voteWeights = voteWeights;
    this.maxRevotes = maxRevotes;
    this.tieDeath = tieDeath;
  }

  castVote(voterId: string, targetId: string): void {
    this.votes = this.votes.filter(v => v.voterId !== voterId);
    this.votes.push({ voterId, targetId });
  }

  revokeVote(voterId: string): void {
    this.votes = this.votes.filter(v => v.voterId !== voterId);
  }

  hasVoted(voterId: string): boolean {
    return this.votes.some(v => v.voterId === voterId);
  }

  allVoted(eligibleVoters: string[]): boolean {
    return eligibleVoters.every(id => this.hasVoted(id));
  }

  tally(): VoteResult[] {
    const counts = new Map<string, { count: number; voters: string[] }>();
    for (const vote of this.votes) {
      const weight = this.voteWeights.get(vote.voterId) ?? 1;
      const existing = counts.get(vote.targetId) ?? { count: 0, voters: [] };
      existing.count += weight;
      existing.voters.push(vote.voterId);
      counts.set(vote.targetId, existing);
    }
    return Array.from(counts.entries())
      .map(([targetId, { count, voters }]) => ({ targetId, count, voters }))
      .sort((a, b) => b.count - a.count);
  }

  resolve(): { executed: string | null; isTie: boolean; tied: string[] } {
    const results = this.tally();
    if (results.length === 0) return { executed: null, isTie: false, tied: [] };

    const topCount = results[0].count;
    const tied = results.filter(r => r.count === topCount).map(r => r.targetId);

    if (tied.length === 1) {
      return { executed: tied[0], isTie: false, tied: [] };
    }

    switch (this.tieDeath) {
      case 'random': {
        const chosen = tied[Math.floor(Math.random() * tied.length)];
        return { executed: chosen, isTie: true, tied };
      }
      case 'no_execute':
        return { executed: null, isTie: true, tied };
      case 'all_execute':
        return { executed: tied[0], isTie: true, tied };
    }
  }

  canRevote(): boolean {
    return this.revoteCount < this.maxRevotes;
  }

  startRevote(candidates: string[]): void {
    this.revoteCount++;
    this.votes = this.votes.filter(v => candidates.includes(v.targetId));
  }

  reset(): void {
    this.votes = [];
  }

  getRevoteCount(): number {
    return this.revoteCount;
  }

  getVotes(): VoteRecord[] {
    return [...this.votes];
  }
}
