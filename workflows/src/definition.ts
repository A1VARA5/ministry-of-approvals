import {
  defineAction,
  defineActivity,
  defineEffect,
  defineField,
  defineGuard,
  defineStage,
  defineTransition,
  defineWorkflow,
} from '@sanity/workflow-engine/define'

// The Ministry of Approvals, as a state machine stored next to the content.
//
// intake (Front Desk) -> department-a (Pedantry) -> department-b (Rubber Stamps)
//   -> department-c (The Archive) -> minister-review (a human) -> certified -> on-the-wall
//
// Pedantry sends incomplete forms back to intake with a demand. The Archive loses every third
// serial once and sends it back to intake with a receipt. The Minister approves, rejects (back to
// intake with a reason) or refers the file to a department. A Minister who sits on a file past
// the deadline loses it to the Archive (the Department of Delays, time based, driven by tick).
// A citizen can withdraw at the desk, which ends in the shredder. Guards freeze the submission
// while a department holds it and stop it being deleted mid corridor. Every AI clerk is an
// effect; every human decision is an action; both move the instance through the same
// transitions, which is the point of the exercise.

export const WORKFLOW_NAME = 'ministry-approval'

const SUBJECT = '$fields.subject._id'

export const DEPARTMENT_STAGES = ['department-a', 'department-b', 'department-c'] as const

// The Minister has this long to rule before the Department of Delays takes the file. A GROQ
// query value, resolved on stage entry, so the deadline is stamped per visit.
export const MINISTER_HOURS = 1

// While a clerk or the Minister holds the form nobody may change what it says or delete it.
// The Studio plugin greys the actions out and names this workflow as the reason.
const holdGuards = (stage: string) => [
  defineGuard({
    name: `freeze-form-${stage}`,
    title: 'Form is being processed',
    description: 'Title, kind and body are frozen while a department holds the form.',
    match: {idRefs: [{type: 'fieldRead', field: 'subject'}], actions: ['update']},
    predicate: '!delta::changedAny((title, kind, body, citizen))',
  }),
  defineGuard({
    name: `no-shredding-${stage}`,
    title: 'Form is in the corridor',
    description: 'A form cannot be deleted while it is in the corridor. Withdraw it at the Front Desk.',
    match: {idRefs: [{type: 'fieldRead', field: 'subject'}], actions: ['delete']},
  }),
]

export const ministryApproval = defineWorkflow({
  name: WORKFLOW_NAME,
  title: 'Ministry approval',
  description: 'Three departments, one Minister, one certificate. Forms may be lost.',
  initialStage: 'intake',
  fields: [
    defineField({
      type: 'subject',
      name: 'subject',
      title: 'Submission',
      required: true,
      initialValue: {type: 'input'},
    }),
    // How many times the Archive has lost this form. field.inc needs a number to exist.
    defineField({type: 'number', name: 'lostCount', initialValue: {type: 'literal', value: 0}}),
    // Set by the Department of Pedantry when it returns a form. Cleared by a resubmission.
    defineField({type: 'string', name: 'demand'}),
    // Set once Pedantry has accepted the form, so a lost-and-found form is not re-inspected.
    defineField({type: 'boolean', name: 'pedanticApproved'}),
    // Set by the Minister on rejection. Cleared by a resubmission.
    defineField({type: 'string', name: 'rejectionReason'}),
    // The citizen's latest amendment and what it answers. The Department of Pedantry writes the
    // amendment onto the submission document and clears these, so the workflow owns that write
    // and every caller (site, Studio, CLI, back office) gets the same behaviour.
    defineField({type: 'string', name: 'amendment'}),
    defineField({type: 'string', name: 'answeredDemand'}),
    defineField({type: 'string', name: 'answeredRejection'}),
    defineField({type: 'string', name: 'ministerNote'}),
    // Latest remark from each department, copied onto the certificate as stamps.
    defineField({type: 'string', name: 'remarkPedantry'}),
    defineField({type: 'string', name: 'remarkRubber'}),
    defineField({type: 'string', name: 'remarkArchive'}),
    // Which department the Minister referred the file to.
    defineField({type: 'string', name: 'referTo'}),
    // Set by the Department of Delays when the Minister sat on the file too long. The Archive
    // loses an overdue form regardless of its serial, then clears the flag.
    defineField({type: 'boolean', name: 'overdue'}),
    // How many times the Minister let a deadline pass. On the certificate.
    defineField({type: 'number', name: 'delays', initialValue: {type: 'literal', value: 0}}),
    // Who is Minister for this file today. Picked in the back office.
    defineField({type: 'assignee', name: 'minister', title: 'Minister on duty', editable: true}),
  ],
  stages: [
    defineStage({
      name: 'intake',
      title: 'Front Desk',
      fields: [defineField({type: 'string', name: 'intakeDecision'})],
      activities: [
        defineActivity({
          name: 'receive',
          title: 'Receive the form',
          actions: [
            // Fires by itself when nothing is outstanding: first arrival, or back from the Archive.
            defineAction({
              name: 'stamp-in',
              title: 'Stamped in',
              when: '!defined($fields.demand) && !defined($fields.rejectionReason)',
              status: 'done',
            }),
            // The citizen answers a demand or a rejection. The text is parked on the instance;
            // the Department of Pedantry files it onto the submission document.
            defineAction({
              name: 'resubmit',
              title: 'Resubmit with an amendment',
              status: 'done',
              params: [
                {type: 'string', name: 'amendment', title: 'Your amendment', required: true},
              ],
              ops: [
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'amendment'},
                  value: {type: 'param', param: 'amendment'},
                },
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'answeredDemand'},
                  value: {type: 'fieldRead', field: 'demand', scope: 'workflow'},
                },
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'answeredRejection'},
                  value: {type: 'fieldRead', field: 'rejectionReason', scope: 'workflow'},
                },
                {type: 'field.unset', target: {scope: 'workflow', field: 'demand'}},
                {type: 'field.unset', target: {scope: 'workflow', field: 'rejectionReason'}},
                {
                  type: 'field.set',
                  target: {field: 'intakeDecision'},
                  value: {type: 'literal', value: 'resubmit'},
                },
              ],
            }),
            defineAction({
              name: 'withdraw',
              title: 'Withdraw the form',
              status: 'done',
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'intakeDecision'},
                  value: {type: 'literal', value: 'withdraw'},
                },
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-pedantry',
          title: 'Down the corridor',
          to: 'department-a',
          when: "$allActivitiesDone && !($fields.intakeDecision == 'withdraw')",
        }),
        defineTransition({
          name: 'to-shredder',
          title: 'Withdrawn',
          to: 'shredded',
          when: "$allActivitiesDone && $fields.intakeDecision == 'withdraw'",
        }),
      ],
    }),

    defineStage({
      name: 'department-a',
      title: 'Department of Pedantry',
      guards: holdGuards('department-a'),
      activities: [
        defineActivity({
          name: 'inspect',
          title: 'Inspect the form',
          actions: [
            defineAction({
              name: 'inspect',
              title: 'Clerk inspects',
              when: 'true',
              effects: [
                defineEffect({
                  name: 'clerk-pedantic',
                  bindings: {
                    subject: SUBJECT,
                    previouslyApproved: '$fields.pedanticApproved == true',
                    lostCount: '$fields.lostCount',
                    amendment: '$fields.amendment',
                    answeredDemand: '$fields.answeredDemand',
                    answeredRejection: '$fields.answeredRejection',
                  },
                  outputs: [
                    {type: 'boolean', name: 'complete'},
                    {type: 'string', name: 'remark'},
                  ],
                }),
              ],
            }),
            defineAction({
              name: 'inspected',
              title: 'Inspection complete',
              when: "$effectStatus['clerk-pedantic'] == 'done'",
              status: 'done',
            }),
            defineAction({
              name: 'clerk-broke',
              title: 'Clerk unavailable',
              when: "$effectStatus['clerk-pedantic'] == 'failed'",
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'to-rubber',
          title: 'Complete, next department',
          to: 'department-b',
          when: "$allActivitiesDone && $effects['clerk-pedantic'].complete == true",
        }),
        defineTransition({
          name: 'returned',
          title: 'Returned with a demand',
          to: 'intake',
          when: "$allActivitiesDone && $effects['clerk-pedantic'].complete == false",
        }),
        defineTransition({
          name: 'escalate',
          title: 'Clerk failed, Minister decides',
          to: 'minister-review',
          when: '$anyActivityFailed',
        }),
      ],
    }),

    defineStage({
      name: 'department-b',
      title: 'Department of Rubber Stamps',
      guards: holdGuards('department-b'),
      activities: [
        defineActivity({
          name: 'stamp',
          title: 'Stamp the form',
          actions: [
            defineAction({
              name: 'stamp',
              title: 'Clerk stamps',
              when: 'true',
              effects: [
                defineEffect({
                  name: 'clerk-rubber',
                  bindings: {subject: SUBJECT},
                  outputs: [{type: 'string', name: 'remark'}],
                }),
              ],
            }),
            defineAction({
              name: 'stamped',
              title: 'Stamped',
              when: "$effectStatus['clerk-rubber'] == 'done'",
              status: 'done',
            }),
            defineAction({
              name: 'clerk-broke',
              title: 'Clerk unavailable',
              when: "$effectStatus['clerk-rubber'] == 'failed'",
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-archive', title: 'To the Archive', to: 'department-c'}),
        defineTransition({
          name: 'escalate',
          title: 'Clerk failed, Minister decides',
          to: 'minister-review',
          when: '$anyActivityFailed',
        }),
      ],
    }),

    defineStage({
      name: 'department-c',
      title: 'The Archive',
      guards: holdGuards('department-c'),
      activities: [
        defineActivity({
          name: 'file',
          title: 'File the form',
          actions: [
            defineAction({
              name: 'file',
              title: 'Archivist files',
              when: 'true',
              effects: [
                defineEffect({
                  name: 'clerk-archive',
                  bindings: {subject: SUBJECT, lostCount: '$fields.lostCount', overdue: '$fields.overdue == true'},
                  outputs: [
                    {type: 'boolean', name: 'lost'},
                    {type: 'string', name: 'remark'},
                  ],
                }),
              ],
            }),
            defineAction({
              name: 'filed',
              title: 'Filed (or not)',
              when: "$effectStatus['clerk-archive'] == 'done'",
              status: 'done',
            }),
            defineAction({
              name: 'clerk-broke',
              title: 'Archivist unavailable',
              when: "$effectStatus['clerk-archive'] == 'failed'",
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'lost',
          title: 'Lost. Start again.',
          to: 'intake',
          when: "$allActivitiesDone && $effects['clerk-archive'].lost == true",
        }),
        defineTransition({
          name: 'to-minister',
          title: "To the Minister's desk",
          to: 'minister-review',
          when: "$allActivitiesDone && $effects['clerk-archive'].lost == false",
        }),
        defineTransition({
          name: 'escalate',
          title: 'Archivist failed, Minister decides',
          to: 'minister-review',
          when: '$anyActivityFailed',
        }),
      ],
    }),

    defineStage({
      name: 'minister-review',
      title: "The Minister's Desk",
      guards: holdGuards('minister-review'),
      fields: [
        defineField({type: 'string', name: 'decision'}),
        // Stamped on entry: the Minister's deadline for this visit.
        defineField({
          type: 'datetime',
          name: 'deadline',
          title: 'Rule by',
          initialValue: {type: 'query', query: `string(dateTime(now()) + ${MINISTER_HOURS * 3600})`},
        }),
      ],
      activities: [
        defineActivity({
          name: 'rule',
          title: 'Rule on the file',
          actions: [
            // The Department of Delays. Fires by itself once the deadline has passed and a tick
            // (scheduled Function, or the site) re-evaluates the instance.
            defineAction({
              name: 'sat-too-long',
              title: 'Deadline passed',
              when: '$fields.deadline <= $now',
              status: 'done',
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'overdue'},
                },
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'overdue'},
                  value: {type: 'literal', value: true},
                },
                {type: 'field.inc', target: {scope: 'workflow', field: 'delays'}},
              ],
            }),
            defineAction({
              name: 'approve',
              title: 'Approve',
              status: 'done',
              // Required: field.set refuses an undefined param, and a certificate deserves a word.
              params: [{type: 'string', name: 'note', title: 'Note for the certificate', required: true}],
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'approve'},
                },
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'ministerNote'},
                  value: {type: 'param', param: 'note'},
                },
              ],
            }),
            defineAction({
              name: 'reject',
              title: 'Reject with a reason',
              status: 'done',
              params: [{type: 'string', name: 'reason', title: 'Reason', required: true}],
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'reject'},
                },
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'rejectionReason'},
                  value: {type: 'param', param: 'reason'},
                },
              ],
            }),
            defineAction({
              name: 'refer',
              title: 'Refer to a department',
              status: 'done',
              params: [
                {
                  type: 'string',
                  name: 'department',
                  title: 'Send it to',
                  required: true,
                  options: {
                    list: [
                      {title: 'Department of Pedantry', value: 'department-a'},
                      {title: 'Department of Rubber Stamps', value: 'department-b'},
                      {title: 'The Archive', value: 'department-c'},
                    ],
                  },
                },
              ],
              ops: [
                {
                  type: 'field.set',
                  target: {field: 'decision'},
                  value: {type: 'literal', value: 'refer'},
                },
                {
                  type: 'field.set',
                  target: {scope: 'workflow', field: 'referTo'},
                  value: {type: 'param', param: 'department'},
                },
                // A referral to Pedantry means a real re-inspection.
                {type: 'field.unset', target: {scope: 'workflow', field: 'pedanticApproved'}},
              ],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({
          name: 'approved',
          title: 'Approved',
          to: 'certified',
          when: "$allActivitiesDone && $fields.decision == 'approve'",
        }),
        defineTransition({
          name: 'rejected',
          title: 'Rejected, back to the desk',
          to: 'intake',
          when: "$allActivitiesDone && $fields.decision == 'reject'",
        }),
        defineTransition({
          name: 'to-delays',
          title: 'Sat too long, off to the Archive',
          to: 'department-c',
          when: "$allActivitiesDone && $fields.decision == 'overdue'",
        }),
        ...DEPARTMENT_STAGES.map((stage) =>
          defineTransition({
            name: `refer-${stage}`,
            title: `Referred to ${stage}`,
            to: stage,
            when: `$allActivitiesDone && $fields.decision == 'refer' && $fields.referTo == '${stage}'`,
          }),
        ),
      ],
    }),

    defineStage({
      name: 'certified',
      title: 'Certifying',
      activities: [
        defineActivity({
          name: 'issue',
          title: 'Issue the certificate',
          actions: [
            defineAction({
              name: 'issue',
              title: 'Print the certificate',
              when: 'true',
              effects: [
                defineEffect({
                  name: 'issue-certificate',
                  bindings: {
                    subject: SUBJECT,
                    instanceId: '$self._id',
                    ministerNote: '$fields.ministerNote',
                    lostCount: '$fields.lostCount',
                    delays: '$fields.delays',
                    remarkPedantry: '$fields.remarkPedantry',
                    remarkRubber: '$fields.remarkRubber',
                    remarkArchive: '$fields.remarkArchive',
                  },
                  outputs: [{type: 'string', name: 'certificateNumber'}],
                }),
              ],
            }),
            // The external API call: a Discord webhook announces the certificate.
            defineAction({
              name: 'announce',
              title: 'Announce it',
              when: "$effectStatus['issue-certificate'] == 'done'",
              effects: [
                defineEffect({
                  name: 'announce',
                  bindings: {
                    subject: SUBJECT,
                    certificateNumber: "$effects['issue-certificate'].certificateNumber",
                  },
                  retry: {attempts: 3, backoff: {kind: 'exponential', delayMs: 2_000}},
                }),
              ],
            }),
            defineAction({
              name: 'framed',
              title: 'Framed',
              when: "$effectStatus['issue-certificate'] == 'done' && $effectStatus['announce'] == 'done'",
              status: 'done',
            }),
            defineAction({
              name: 'printer-jam',
              title: 'Printer jam',
              when: "$effectStatus['issue-certificate'] == 'failed' || $effectStatus['announce'] == 'failed'",
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-wall', title: 'On the wall', to: 'on-the-wall'}),
        // The certificate exists even if the town crier failed. Frame it anyway.
        defineTransition({
          name: 'to-wall-quietly',
          title: 'On the wall, unannounced',
          to: 'on-the-wall',
          when: "$anyActivityFailed && $effectStatus['issue-certificate'] == 'done'",
        }),
      ],
    }),

    defineStage({name: 'on-the-wall', title: 'On the Wall'}),
    defineStage({name: 'shredded', title: 'Shredded'}),
  ],
})
