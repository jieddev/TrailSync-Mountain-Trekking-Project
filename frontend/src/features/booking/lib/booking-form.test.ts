import { describe, expect, it } from 'vitest'

import {
  type BookingFormValues,
  fieldErrorsFromApi,
  formatMoney,
  manilaTodayIso,
  MAX_RECEIPT_BYTES,
  todayLocalIso,
  toCreateBookingInput,
  validateBookingForm,
  validateReceipt,
  validateSchedule,
} from './booking-form'
import { WAIVER_VERSION } from '../../legal/agreements'

const today = '2026-10-18'

const validValues: BookingFormValues = {
  trailId: 'trl_sulfatara',
  scheduledDate: '2026-11-20',
  scheduledTime: '08:00',
  ownerAddress: ' Ormoc City, Leyte ',
  additionalParticipants: [
    {
      name: ' Maria Dela Cruz ',
      age: '26',
      address: 'Ormoc City, Leyte',
      email: ' maria@example.com ',
    },
  ],
  paymentOption: 'DOWNPAYMENT',
  receipt: new File([new Uint8Array(10)], 'receipt.png', { type: 'image/png' }),
  referenceNumber: '',
  acceptedWaiver: true,
}

describe('validateReceipt', () => {
  const image = (type: string, size = 10) =>
    new File([new Uint8Array(size)], 'receipt', { type })

  it('accepts a screenshot with or without a reference number', () => {
    expect(validateReceipt(image('image/jpeg'), '')).toEqual({})
    expect(validateReceipt(image('image/webp'), '1234 567 890123')).toEqual({})
  })

  it('requires an image of a supported type and size', () => {
    expect(validateReceipt(null, '')).toHaveProperty('receipt')
    expect(validateReceipt(image('application/pdf'), '')).toHaveProperty(
      'receipt',
    )
    expect(
      validateReceipt(image('image/png', MAX_RECEIPT_BYTES + 1), ''),
    ).toHaveProperty('receipt')
  })

  it('rejects a reference number that is not 13 digits', () => {
    expect(validateReceipt(image('image/png'), '12345')).toHaveProperty(
      'referenceNumber',
    )
  })
})

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
        ownerAddress: '  ',
        additionalParticipants: [],
        paymentOption: '',
        receipt: null,
        referenceNumber: '',
        acceptedWaiver: false,
      },
      4,
      today,
    )
    expect(Object.keys(errors).sort()).toEqual([
      'acceptedWaiver',
      'ownerAddress',
      'paymentOption',
      'receipt',
      'scheduledDate',
      'scheduledTime',
      'trailId',
    ])
  })

  it('requires additional participants to be 18 or older', () => {
    const person = validValues.additionalParticipants[0]
    expect(
      validateBookingForm(
        { ...validValues, additionalParticipants: [{ ...person, age: '17' }] },
        4,
        today,
      ),
    ).toEqual({
      'additionalParticipants.0.age': 'Every participant must be 18 or older.',
    })
    expect(
      validateBookingForm(
        { ...validValues, additionalParticipants: [{ ...person, age: '18' }] },
        4,
        today,
      ),
    ).toEqual({})
  })

  it('validates each additional participant by index', () => {
    const errors = validateBookingForm(
      {
        ...validValues,
        additionalParticipants: [
          validValues.additionalParticipants[0],
          { name: '', age: '0', address: '', email: 'maria@' },
        ],
      },
      4,
      today,
    )
    expect(errors).toEqual({
      'additionalParticipants.1.name': 'Enter a name.',
      'additionalParticipants.1.age': 'Enter the age as a whole number.',
      'additionalParticipants.1.address': 'Enter an address.',
      'additionalParticipants.1.email':
        'Enter a valid email or leave it blank.',
    })
  })

  it('requires agreeing to the trek waiver', () => {
    expect(
      validateBookingForm({ ...validValues, acceptedWaiver: false }, 4, today),
    ).toEqual({
      acceptedWaiver: 'Agree to the Trek Waiver and Trail Rules to book.',
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
      ownerDetails: { address: 'Ormoc City, Leyte' },
      additionalParticipants: [
        {
          name: 'Maria Dela Cruz',
          age: 26,
          address: 'Ormoc City, Leyte',
          email: 'maria@example.com',
        },
      ],
      paymentOption: 'DOWNPAYMENT',
      acceptedWaiverVersion: WAIVER_VERSION,
    })
  })

  it('leaves out a blank email', () => {
    const person = { ...validValues.additionalParticipants[0], email: ' ' }
    expect(
      toCreateBookingInput({ ...validValues, additionalParticipants: [person] })
        .additionalParticipants[0],
    ).not.toHaveProperty('email')
  })
})

describe('fieldErrorsFromApi', () => {
  it('maps backend fields onto form fields', () => {
    expect(
      fieldErrorsFromApi([
        {
          field: 'ownerDetails.address',
          code: 'REQUIRED',
          message: 'Address is required.',
        },
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
        {
          field: 'acceptedWaiverVersion',
          code: 'WAIVER_NOT_ACCEPTED',
          message: 'Agree to the waiver.',
        },
      ]),
    ).toEqual({
      acceptedWaiver: 'Agree to the waiver.',
      ownerAddress: 'Address is required.',
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
