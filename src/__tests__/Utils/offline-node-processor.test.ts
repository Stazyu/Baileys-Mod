import { jest } from '@jest/globals'
import { makeOfflineNodeProcessor, type OfflineNodeType } from '../../Utils/offline-node-processor'
import { type BinaryNode } from '../../WABinary'

function makeNode(id: string, tag = 'message'): BinaryNode {
	return { tag, attrs: { id, from: 'user@s.whatsapp.net', offline: '1' } }
}

describe('makeOfflineNodeProcessor', () => {
	let mockOnUnexpectedError: jest.Mock<(error: Error, msg: string) => void>
	let isWsOpen: boolean
	let yieldCalls: number

	function createProcessor(handlers: Map<OfflineNodeType, (node: BinaryNode) => Promise<void>>, batchSize = 10) {
		return makeOfflineNodeProcessor(
			handlers,
			{
				isWsOpen: () => isWsOpen,
				onUnexpectedError: mockOnUnexpectedError,
				yieldToEventLoop: async () => {
					yieldCalls++
				}
			},
			batchSize
		)
	}

	beforeEach(() => {
		mockOnUnexpectedError = jest.fn()
		isWsOpen = true
		yieldCalls = 0
	})

	it('processes nodes in FIFO order', async () => {
		const processed: string[] = []
		const handler = jest.fn<(node: BinaryNode) => Promise<void>>().mockImplementation(async node => {
			processed.push(node.attrs.id!)
		})

		const processor = createProcessor(new Map([['message', handler]]))
		processor.enqueue('message', makeNode('msg-1'))
		processor.enqueue('message', makeNode('msg-2'))
		processor.enqueue('message', makeNode('msg-3'))

		await new Promise(r => setTimeout(r, 10))
		expect(processed).toEqual(['msg-1', 'msg-2', 'msg-3'])
	})

	it('continues after handler errors', async () => {
		const processed: string[] = []
		const handler = jest.fn<(node: BinaryNode) => Promise<void>>().mockImplementation(async node => {
			if (node.attrs.id === 'msg-2') {
				throw new Error('boom')
			}

			processed.push(node.attrs.id!)
		})

		const processor = createProcessor(new Map([['message', handler]]))
		processor.enqueue('message', makeNode('msg-1'))
		processor.enqueue('message', makeNode('msg-2'))
		processor.enqueue('message', makeNode('msg-3'))

		await new Promise(r => setTimeout(r, 10))
		expect(processed).toEqual(['msg-1', 'msg-3'])
		expect(mockOnUnexpectedError).toHaveBeenCalledWith(expect.any(Error), 'processing offline message')
	})

	it('stops when websocket closes and resumes later', async () => {
		const processed: string[] = []
		const handler = jest.fn<(node: BinaryNode) => Promise<void>>().mockImplementation(async node => {
			processed.push(node.attrs.id!)
			if (node.attrs.id === 'msg-2') {
				isWsOpen = false
			}
		})

		const processor = createProcessor(new Map([['message', handler]]))
		processor.enqueue('message', makeNode('msg-1'))
		processor.enqueue('message', makeNode('msg-2'))
		processor.enqueue('message', makeNode('msg-3'))

		await new Promise(r => setTimeout(r, 10))
		expect(processed).toEqual(['msg-1', 'msg-2'])

		isWsOpen = true
		processor.enqueue('message', makeNode('msg-4'))

		await new Promise(r => setTimeout(r, 10))
		expect(processed).toEqual(['msg-1', 'msg-2', 'msg-3', 'msg-4'])
	})

	it('yields after each batch', async () => {
		const handler = jest.fn<(node: BinaryNode) => Promise<void>>().mockResolvedValue(undefined)
		const processor = createProcessor(new Map([['message', handler]]), 3)

		for (let i = 1; i <= 7; i++) {
			processor.enqueue('message', makeNode(`msg-${i}`))
		}

		await new Promise(r => setTimeout(r, 10))
		expect(handler).toHaveBeenCalledTimes(7)
		expect(yieldCalls).toBe(2)
	})
})
