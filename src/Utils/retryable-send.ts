import { Boom } from '@hapi/boom'
import { DisconnectReason } from '../Types'
import type { MessageRelayOptions, WAMessage } from '../Types'

export type RetryableSendPayload = {
	targetJid: string
	fullMessage: WAMessage
	relayOptions: MessageRelayOptions
}

export type RetryableStaleConnectionError = Boom & {
	data: {
		staleConnection: true
		retryAfterReconnect: true
		retriable: true
		retryableSend?: RetryableSendPayload
	}
}

export const isRetryableStaleConnectionError = (
	error: unknown
): error is RetryableStaleConnectionError => {
	if (!(error instanceof Boom)) {
		return false
	}

	return (
		error.output?.statusCode === DisconnectReason.connectionLost &&
		error.data?.staleConnection === true &&
		error.data?.retryAfterReconnect === true
	)
}

export const getRetryableSendPayload = (error: unknown) => {
	if (!isRetryableStaleConnectionError(error)) {
		return undefined
	}

	return error.data?.retryableSend
}

export const retrySendAfterReconnect = async (
	socket: {
		relayMessage: (jid: string, message: NonNullable<WAMessage['message']>, options: MessageRelayOptions) => Promise<string>
	},
	error: unknown
) => {
	const payload = getRetryableSendPayload(error)
	if (!payload?.fullMessage.message) {
		throw error
	}

	return socket.relayMessage(payload.targetJid, payload.fullMessage.message, payload.relayOptions)
}
