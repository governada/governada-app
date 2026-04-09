import { describe, expect, it } from 'vitest';
import {
  buildReviewDiscipline,
  summarizeReview,
  toSystemsCommitment,
  toSystemsReviewRecord,
} from '@/lib/admin/systemsReview';

describe('systems review helpers', () => {
  it('marks review discipline critical when no review has been logged', () => {
    const discipline = buildReviewDiscipline([], []);

    expect(discipline.status).toBe('critical');
    expect(discipline.currentValue).toBe('0 recent reviews');
  });

  it('marks review discipline warning when an open commitment is overdue', () => {
    const reviewedAt = new Date();
    reviewedAt.setDate(reviewedAt.getDate() - 3);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 1);

    const commitment = toSystemsCommitment({
      id: '6d872854-b7ab-4ae8-a7bf-ce58fa4f5f90',
      review_id: '1d9cad5c-6ba5-4c9a-8f70-9835cff31568',
      title: 'Add deterministic DRep read harness',
      summary: 'Protect the workspace read path.',
      owner: 'Founder + agents',
      status: 'planned',
      due_date: dueDate.toISOString().slice(0, 10),
      linked_slo_ids: ['journeys'],
      created_at: reviewedAt.toISOString(),
    });
    const review = toSystemsReviewRecord(
      {
        id: '1d9cad5c-6ba5-4c9a-8f70-9835cff31568',
        review_date: reviewedAt.toISOString().slice(0, 10),
        reviewed_at: reviewedAt.toISOString(),
        overall_status: 'warning',
        focus_area: 'Critical journey protection',
        summary: 'Workspace read confidence still needs browser-level proof.',
        top_risk: 'Operator workflows remain under-defended.',
        change_notes: 'We still need a deterministic seeded harness for workspace reads.',
        linked_slo_ids: ['journeys'],
      },
      commitment,
    );

    const discipline = buildReviewDiscipline([review], [commitment]);

    expect(discipline.status).toBe('warning');
    expect(discipline.overdueCommitments).toBe(1);
  });

  it('creates compact review summaries for stored history', () => {
    const summary = summarizeReview(
      'Freshness is drifting toward the edge of the launch bar.',
      'Fast sync stayed inside the bar, but full sync drifted after a failed run and needs a fresh operator check before feature work resumes.',
    );

    expect(summary).toMatch(/Fast sync stayed inside the bar/i);
    expect(summary.length).toBeLessThanOrEqual(180);
  });
});
