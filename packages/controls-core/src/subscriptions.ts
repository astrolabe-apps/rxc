import { ControlChange } from "./types.js";
import type { ChangeListener, Subscription, WriteContext } from "./types.js";
import type { ControlImpl } from "./controlImpl.js";

interface SubscriptionInternal extends Subscription {
  list: SubscriptionList;
}

export class Subscriptions {
  lists: SubscriptionList[] = [];
  mask: ControlChange = 0 as ControlChange;

  subscribe(
    listener: ChangeListener<any>,
    current: ControlChange,
    mask: ControlChange,
  ): Subscription {
    let list = this.lists.find((x) => x.canBeAdded(current, mask));
    if (!list) {
      list = new SubscriptionList(current, mask);
      this.lists.push(list);
    }
    this.mask |= mask;
    return list.add(listener, mask);
  }

  unsubscribe(sub: Subscription): void {
    (sub as SubscriptionInternal).list.remove(sub);
  }

  hasSubscriptions(): boolean {
    return this.lists.some((l) => l.hasSubscriptions());
  }

  runListeners(control: ControlImpl, current: ControlChange, wc: WriteContext) {
    this.lists.forEach((s) => s.runListeners(control, current, wc));
  }

  runMatchingListeners(control: ControlImpl, mask: ControlChange, wc: WriteContext) {
    this.lists.forEach((s) => s.runMatchingListeners(control, mask, wc));
  }

  applyChange(change: ControlChange) {
    this.lists.forEach((x) => x.applyChange(change));
  }
}

class SubscriptionList {
  subscriptions: Subscription[] = [];

  constructor(
    private changeState: ControlChange,
    public mask: ControlChange,
  ) {}

  remove(sub: Subscription) {
    this.subscriptions = this.subscriptions.filter((x) => x !== sub);
  }

  runMatchingListeners(control: ControlImpl, mask: ControlChange, wc: WriteContext) {
    this.subscriptions.forEach((s) => {
      const change = s.mask & mask;
      if (change) s.listener(control, change, wc);
    });
  }

  runListeners(control: ControlImpl, current: ControlChange, wc: WriteContext) {
    const nextCurrent = (current & this.mask) as ControlChange;
    const actualChange = (nextCurrent ^ this.changeState) as ControlChange;
    this.changeState = nextCurrent;
    if (actualChange) {
      this.runMatchingListeners(control, actualChange, wc);
    }
  }

  applyChange(change: ControlChange) {
    this.changeState |= change & this.mask;
  }

  add(listener: ChangeListener<any>, mask: ControlChange): Subscription {
    const sub: SubscriptionInternal = {
      list: this,
      mask,
      listener: listener as ChangeListener<any>,
    };
    this.mask |= mask;
    this.subscriptions.push(sub);
    return sub;
  }

  canBeAdded(current: ControlChange, mask: ControlChange): boolean {
    return (this.changeState & mask) === current;
  }

  hasSubscriptions(): boolean {
    return this.subscriptions.length > 0;
  }
}
