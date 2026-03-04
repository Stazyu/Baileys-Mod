import { jest } from '@jest/globals'
import { proto, type WAMessage } from '../..'
import { DEFAULT_CONNECTION_CONFIG } from '../../Defaults'
import makeWASocket from '../../Socket'
import { makeSession, mockWebSocket } from '../TestUtils/session'

mockWebSocket()

describe('Reconnection Sync Skip', () => {
	it('skips 20s history sync wait on reconnection', async () => {
		const { state, clear } = await makeSession()

		state.creds.me = { id: '1234567890:1@s.whatsapp.net', name: 'Test User' }
		state.creds.accountSyncCounter = 1

		const sock = makeWASocket({
			...DEFAULT_CONNECTION_CONFIG,
			auth: state
		})

		const messageListener = jest.fn()
		sock.ev.on('messages.upsert', messageListener)

		sock.ev.emit('connection.update', { receivedPendingNotifications: true })

		const msg = proto.WebMessageInfo.fromObject({
			key: { remoteJid: '1234567890@s.whatsapp.net', fromMe: false, id: 'MSG_AFTER_RECONNECT' },
			messageTimestamp: Date.now() / 1000,
			message: { conversation: 'Hello after reconnect' }
		}) as WAMessage
		sock.ev.emit('messages.upsert', { messages: [msg], type: 'notify' })

		await new Promise(resolve => setTimeout(resolve, 50))

		expect(messageListener).toHaveBeenCalledTimes(1)
		expect(messageListener).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([expect.objectContaining({ key: msg.key })]),
				type: 'notify'
			})
		)

		await sock.end(new Error('Test completed'))
		await clear()
	})

	it('still waits for history sync on fresh pairing', async () => {
		const { state, clear } = await makeSession()

		state.creds.me = { id: '1234567890:1@s.whatsapp.net', name: 'Test User' }
		state.creds.accountSyncCounter = 0

		const sock = makeWASocket({
			...DEFAULT_CONNECTION_CONFIG,
			auth: state
		})

		const messageListener = jest.fn()
		sock.ev.on('messages.upsert', messageListener)

		sock.ev.emit('connection.update', { receivedPendingNotifications: true })

		const msg = proto.WebMessageInfo.fromObject({
			key: { remoteJid: '1234567890@s.whatsapp.net', fromMe: false, id: 'MSG_DURING_INITIAL_SYNC' },
			messageTimestamp: Date.now() / 1000,
			message: { conversation: 'Hello during initial sync' }
		}) as WAMessage
		sock.ev.emit('messages.upsert', { messages: [msg], type: 'notify' })

		await new Promise(resolve => setTimeout(resolve, 50))

		expect(messageListener).toHaveBeenCalledTimes(0)

		await sock.end(new Error('Test completed'))
		await clear()
	})
})
