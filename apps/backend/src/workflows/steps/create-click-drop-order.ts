import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { ROYALMAIL_MODULE } from "../../modules/royalmail"
import RoyalMailService from "../../modules/royalmail/service"
import { buildClickDropOrder, MappableOrder } from "../../modules/royalmail/mapper"

type Input = {
  order: MappableOrder
}

export type CreatedClickDropOrder = {
  orderIdentifier: number
  orderReference?: string
  trackingNumber?: string
}

// Imports a single Medusa order into Royal Mail Click & Drop.
// Compensation deletes the created C&D order so a failed downstream step
// (e.g. writing the identifier back to the order) leaves no duplicate behind.
export const createClickDropOrderStep = createStep(
  "create-click-drop-order",
  async ({ order }: Input, { container }) => {
    const royalmail = container.resolve<RoyalMailService>(ROYALMAIL_MODULE)

    const payload = buildClickDropOrder(order, {
      defaultItemWeightG: royalmail.defaultItemWeightG,
      defaultPackageFormat: royalmail.defaultPackageFormat,
      senderTradingName: royalmail.senderTradingName,
    })

    const result = await royalmail.createOrders([payload])

    if (!result?.createdOrders?.length) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Royal Mail rejected the order: ${JSON.stringify(result?.failedOrders ?? result)}`
      )
    }

    const created = result.createdOrders[0]
    const output: CreatedClickDropOrder = {
      orderIdentifier: created.orderIdentifier,
      orderReference: created.orderReference,
      trackingNumber: created.trackingNumber,
    }

    return new StepResponse(output, created.orderIdentifier)
  },
  async (orderIdentifier, { container }) => {
    if (!orderIdentifier) {
      return
    }
    const royalmail = container.resolve<RoyalMailService>(ROYALMAIL_MODULE)
    await royalmail.deleteOrders([orderIdentifier]).catch(() => {
      // best-effort rollback — don't mask the original failure
    })
  }
)
