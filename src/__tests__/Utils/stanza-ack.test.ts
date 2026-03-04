import { buildAckStanza } from '../../Utils/stanza-ack'
import { type BinaryNode } from '../../WABinary'

describe('buildAckStanza', () => {
	it('builds a minimal ack stanza', () => {
		const node: BinaryNode = {
			tag: 'message',
			attrs: {
				id: 'msg-001',
				from: 'user@s.whatsapp.net'
			}
		}

		expect(buildAckStanza(node)).toEqual({
			tag: 'ack',
			attrs: {
				id: 'msg-001',
				to: 'user@s.whatsapp.net',
				class: 'message'
			}
		})
	})

	it('forwards participant, recipient, and type', () => {
		const node: BinaryNode = {
			tag: 'receipt',
			attrs: {
				id: 'rcpt-001',
				from: 'group@g.us',
				participant: 'sender@s.whatsapp.net',
				recipient: 'me@s.whatsapp.net',
				type: 'read'
			}
		}

		expect(buildAckStanza(node)).toEqual({
			tag: 'ack',
			attrs: {
				id: 'rcpt-001',
				to: 'group@g.us',
				class: 'receipt',
				participant: 'sender@s.whatsapp.net',
				recipient: 'me@s.whatsapp.net',
				type: 'read'
			}
		})
	})

	it('adds error for nacks', () => {
		const node: BinaryNode = {
			tag: 'message',
			attrs: { id: 'msg-001', from: 'user@s.whatsapp.net' }
		}

		expect(buildAckStanza(node, 500)).toEqual({
			tag: 'ack',
			attrs: {
				id: 'msg-001',
				to: 'user@s.whatsapp.net',
				class: 'message',
				error: '500'
			}
		})
	})

	it('always includes from for message acks when meId is provided', () => {
		const node: BinaryNode = {
			tag: 'message',
			attrs: {
				id: 'msg-001',
				from: 'user@s.whatsapp.net',
				type: 'text'
			}
		}

		expect(buildAckStanza(node, undefined, 'me@s.whatsapp.net')).toEqual({
			tag: 'ack',
			attrs: {
				id: 'msg-001',
				to: 'user@s.whatsapp.net',
				class: 'message',
				type: 'text',
				from: 'me@s.whatsapp.net'
			}
		})
	})

	it('does not add from for non-message acks', () => {
		const node: BinaryNode = {
			tag: 'notification',
			attrs: {
				id: 'notif-001',
				from: 'user@s.whatsapp.net',
				type: 'encrypt'
			}
		}

		expect(buildAckStanza(node, undefined, 'me@s.whatsapp.net')).toEqual({
			tag: 'ack',
			attrs: {
				id: 'notif-001',
				to: 'user@s.whatsapp.net',
				class: 'notification',
				type: 'encrypt'
			}
		})
	})
})
