import { Boom } from '@hapi/boom'
import { jest } from '@jest/globals'
import { DisconnectReason } from '../../Types'
import { isConnectionStale } from '../../Socket/socket'
import {
	isRetryableStaleConnectionError,
	retrySendAfterReconnect,
	type RetryableSendPayload
} from '../../Utils/retryable-send'

describe('connection stale guard', () => {
	const keepAliveIntervalMs = 30_000
	const now = new Date('2026-03-03T12:00:00.000Z').getTime()

	test('does not treat missing lastDateRecv as stale', () => {
		expect(isConnectionStale(undefined, keepAliveIntervalMs, now)).toBe(false)
	})

	test('does not treat recent inbound activity as stale', () => {
		const lastDateRecv = new Date(now - keepAliveIntervalMs)
		expect(isConnectionStale(lastDateRecv, keepAliveIntervalMs, now)).toBe(false)
	})

	test('does not treat the exact grace threshold as stale', () => {
		const lastDateRecv = new Date(now - (keepAliveIntervalMs + 5000))
		expect(isConnectionStale(lastDateRecv, keepAliveIntervalMs, now)).toBe(false)
	})

	test('treats outbound send as stale only after keepalive grace is exceeded', () => {
		const lastDateRecv = new Date(now - (keepAliveIntervalMs + 5001))
		expect(isConnectionStale(lastDateRecv, keepAliveIntervalMs, now)).toBe(true)
	})

	test('recognizes stale connection errors as safe to retry after reconnect', () => {
		const error = new Boom('Connection was lost', {
			statusCode: DisconnectReason.connectionLost,
			data: {
				staleConnection: true,
				retryAfterReconnect: true,
				retriable: true
			}
		})

		expect(isRetryableStaleConnectionError(error)).toBe(true)
	})

	test('does not mark generic connectionLost errors as safe to retry automatically', () => {
		const error = new Boom('Connection was lost', {
			statusCode: DisconnectReason.connectionLost
		})

		expect(isRetryableStaleConnectionError(error)).toBe(false)
	})

	test('replays a captured send payload on a reconnected socket', async () => {
		const relayMessage = jest.fn(async () => 'retried-msg-id')
		const payload: RetryableSendPayload = {
			targetJid: '5511999999999@s.whatsapp.net',
			fullMessage: {
				key: {
					remoteJid: '5511999999999@s.whatsapp.net',
					fromMe: true,
					id: 'ABC'
				},
				message: { conversation: 'hello' }
			},
			relayOptions: { messageId: 'ABC' }
		}
		const error = new Boom('Connection was lost', {
			statusCode: DisconnectReason.connectionLost,
			data: {
				staleConnection: true,
				retryAfterReconnect: true,
				retriable: true,
				retryableSend: payload
			}
		})

		const result = await retrySendAfterReconnect({ relayMessage }, error)

		expect(result).toBe('retried-msg-id')
		expect(relayMessage).toHaveBeenCalledWith(payload.targetJid, payload.fullMessage.message, payload.relayOptions)
	})
})
