"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getAppName } from "@/content/site";

/**
 * UpgradeModal — honest placeholder for future paid plans.
 *
 * There is no checkout, pricing, or payment form here on purpose:
 * ScholarSuite is free during early access, so the modal says exactly that.
 */
export function UpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade your plan"
      actions={
        <Button variant="primary" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <p className="font-medium text-slate-900">
        Paid plans are coming soon — {getAppName()} is free during early access.
      </p>
      <p className="mt-2 text-slate-600">
        Every feature is fully available to you right now. There are no usage
        limits and no credit card is required.
      </p>
    </Modal>
  );
}
