import { describe, expect, it } from 'vitest'

import {
  type BookingFormValues,
  fieldErrorsFromApi,
  formatMoney,
  manilaTodayIso,
  todayLocalIso,
  toCreateBookingInput,
  validateBookingForm,
  validateSchedule,
} from './booking-form'

const today = '2026-10-18'

const validValues: BookingFormValues = {
  trailId: 'trl_sulfatara',
  scheduledDate: '2026-11-20',
  scheduledTime: '08:00',
  ownerAge: '28',
  ownerAddress: ' Ormoc City, Leyte ',
  additionalParticipants: [
    { name: ' Maria Dela Cruz ', age: '26', address: 'Ormoc City, Leyte' },
  ],
}

describe('validateBookingForm', () => {
  it('accepts a complete booking', () => {
    expect(validateBookingForm(validValues, 4, today)).toEqual({})
  })

  it('accepts a one-person booking', () => {
    expect(
      validateBookingForm(
        { ...validValues, additionalParticipants: [] },
        4,
        today,
      ),
    ).toEqual({})
  })

  it('reports every missing owner and trip field', () => {
    const errors = validateBookingForm(
      {
        trailId: '',
        scheduledDate: '',
        scheduledTime: '',
        ownerAge: '',
        ownerAddress: '  ',
        additionalParticipants: [],
      },
      4,
      today,
    )
    expect(Object.keys(errors).sort()).toEqual([
      'ownerAddress',
      'ownerAge',
      'scheduledDate',
      'scheduledTime',
      'trailId',
    ])
  })

  it('rejects ages that are not positive whole numbers', () => {
    for (const age of ['0', '-3', '2.5', 'abc']) {
      expect(
        validateBookingForm({ ...validValues, ownerAge: age }, 4, today),
      ).toHaveProperty('ownerAge')
    }
  })

  it('validates each additional participant by index', () => {
    const errors = validateBookingForm(
      {
        ...validValues,
        additionalParticipants: [
          validValues.additionalParticipants[0],
          { name: '', age: '0', address: '' },
        ],
      },
      4,
      today,
    )
    expect(errors).toEqual({
      'additionalParticipants.1.name': 'Enter a name.',
      'additionalParticipants.1.age': 'Enter the age as a whole number.',
      'additionalParticipants.1.address': 'Enter an address.',
    })
  })

  it('enforces the participant cap given by the API', () => {
    const person = validValues.additionalParticipants[0]
    expect(
      validateBookingForm(
        { ...validValues, additionalParticipants: [person, person] },
        1,
        today,
      ),
    ).toHaveProperty('additionalParticipants')
  })
})

describe('validateSchedule', () => {
  it('allows today but not a past date', () => {
    expect(
      validateSchedule({ scheduledDate: today, scheduledTime: '08:00' }, today),
    ).toEqual({})
    expect(
      validateSchedule(
        { scheduledDate: '2026-10-17', scheduledTime: '08:00' },
        today,
      ),
    ).toEqual({ scheduledDate: 'Choose today or a later date.' })
  })
})

describe('toCreateBookingInput', () => {
  it('converts ages to numbers and trims text', () => {
    expect(toCreateBookingInput(validValues)).toEqual({
      trailId: 'trl_sulfatara',
      scheduledDate: '2026-11-20',
      scheduledTime: '08:00',
      ownerDetails: { age: 28, address: 'Ormoc City, Leyte' },
      additionalParticipants: [
        { name: 'Maria Dela Cruz', age: 26, address: 'Ormoc City, Leyte' },
      ],
    })
  })
})

describe('fieldErrorsFromApi', () => {
  it('maps backend fields onto form fields', () => {
    expect(
      fieldErrorsFromApi([
        { field: 'ownerDetails.age', code: 'INVALID_AGE', message: 'Bad age.' },
        {
          field: 'additionalParticipants.0.name',
          code: 'REQUIRED',
          message: 'Name is required.',
        },
        {
          field: 'trailId',
          code: 'UNSUPPORTED_TRAIL',
          message: 'Select a supported trail.',
        },
      ]),
    ).toEqual({
      ownerAge: 'Bad age.',
      'additionalParticipants.0.name': 'Name is required.',
      trailId: 'Select a supported trail.',
    })
  })
})

describe('formatting helpers', () => {
  it('formats API money without recalculating it', () => {
    expect(formatMoney({ amount: 550, currency: 'PHP' })).toBe('₱550')
  })

  it('formats today as a local YYYY-MM-DD date', () => {
    expect(todayLocalIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('manilaTodayIso', () => {
  it('uses the Asia/Manila date whatever the browser timezone', () => {
    expect(manilaTodayIso(new Date('2026-10-20T15:59:00Z'))).toBe('2026-10-20')
    expect(manilaTodayIso(new Date('2026-10-20T16:00:00Z'))).toBe('2026-10-21')
  })
})
