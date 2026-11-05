"""Event loop visuals that many parts use: the call stack, the task and microtask queues, the loop arrow.

Shared base file. Part agents do not edit it. Ask for a change in your report.

    from dwscene import *                      # also imports CallStack, LoopQueue, LoopArrow, run_next

    stack = CallStack().move_to(LEFT * 4.5)
    tasks = LoopQueue("task queue", TASK, shape="ball").move_to(RIGHT * 1.5 + UP * 1.2)
    loop = LoopArrow().next_to(stack, RIGHT)
    self.add(stack, tasks, loop)               # or FadeIn(...)
    self.play(stack.push("main()"), run_time=b.t(0.2))
    self.play(tasks.enqueue("timer 1"), run_time=b.t(0.2))
    self.play(stack.pop(), run_time=b.t(0.2))
    self.play(loop.turn(), run_time=b.t(0.2))
    self.play(run_next(tasks, stack), run_time=b.t(0.2))   # front ball -> new top pancake

The fixed shapes of the video (script `task_queue`): a pancake = one call on the call stack,
a white cube = sync code that runs (CallStack.push_cube), a big ball = a task, a small ball =
a microtask (LoopQueue shape "ball" and "small_ball"). Script v2 shows no phase ring: the event
loop is one circular arrow (LoopArrow).

Each method returns one Animation; play it with a run_time from the beat. The methods change
the object's state at once (a frame or an item is in the list as soon as you call push or
enqueue), so call them in play order. Each animation moves parts of an object that is already
on the screen: add the object to the scene first.

Rules that keep Manim from taking a group apart (see the `group=` note in outline.highlight):
the methods never use FadeIn or FadeOut on a part, and every AnimationGroup they return passes
group=<the object>. Do the same when you combine them: play them as separate arguments,
self.play(a.push(...), q.dequeue()), not inside your own AnimationGroup without group=.
"""
from __future__ import annotations

from manim import *  # noqa: F401,F403

from style import BG, DIM, LABEL, LOOP, MICROTASK, MUTED, SMALL, STACK, TASK, TEXT, T

_DROP = 0.35  # distance a frame or an item travels when it appears or leaves


def _appear(m, shift):
    """Transform that brings m (already placed and in its group) in from `shift` away, from transparent."""
    target = m.copy()
    m.shift(shift).set_opacity(0)
    return Transform(m, target)


def _leave(m, to=None, shift=UP * _DROP):
    """Transform that moves m away (to a point or mobject, or by `shift`) and makes it transparent."""
    target = m.copy()
    if to is not None:
        target.move_to(to.get_center() if isinstance(to, Mobject) else to)
    else:
        target.shift(shift)
    target.set_opacity(0)
    return Transform(m, target)


BALL_R = {"ball": 0.26, "small_ball": 0.17}  # big ball = task, small ball = microtask


class _Item(VGroup):
    """A frame or a queue item: .box (the shape) and .text (VGroup, empty when there is no label).

    shape: pancake (a call on the call stack), box (a queue item with its label inside),
    ball / small_ball (a task / a microtask; the label sits under the ball),
    cube (white: sync code that runs; dark label inside)."""

    def __init__(self, label, color, width, height, mono, size=SMALL, fill=0.22, shape="box"):
        super().__init__()
        self.shape = shape
        txt_color = BG if shape == "cube" else TEXT
        self.text = VGroup(T(label, size, txt_color, mono=mono)) if label else VGroup()
        if shape in BALL_R:
            r = BALL_R[shape]
            self.box = Circle(radius=r, stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.75)
            if label:
                self.text.next_to(self.box, DOWN, buff=0.06)
        else:
            w = max(width or 0, self.text.width + 0.36)
            if shape == "cube":
                self.box = Rectangle(width=w, height=height, stroke_color=TEXT, stroke_width=2.5, fill_color=TEXT,
                                     fill_opacity=0.92)
            else:
                r = min(height * 0.45, 0.22) if shape == "pancake" else 0.08
                self.box = RoundedRectangle(corner_radius=r, width=w, height=height, stroke_color=color,
                                            stroke_width=2.5, fill_color=color, fill_opacity=fill)
            self.text.move_to(self.box)
        self.label, self.concept_color = label, color
        self.slots = 1
        self.add(self.box, self.text)


class CallStack(VGroup):
    """A column of pancakes (one per call) that grows up from a base line. Title under the base line.

    .base, .title, .frames (bottom first). push(label), push_cube(...) and pop() return animations.
    max_frames sets the height the column keeps free (in pancakes); push past it raises ValueError.
    """

    def __init__(self, title="call stack", width=3.2, frame_h=0.5, gap=0.08, max_frames=6, color=STACK,
                 mono=True, **kw):
        super().__init__(**kw)
        self.width_, self.frame_h, self.gap, self.max_frames = width, frame_h, gap, max_frames
        self.color_, self.mono = color, mono
        self.base = Line(LEFT * (width / 2 + 0.15), RIGHT * (width / 2 + 0.15), stroke_color=color, stroke_width=4)
        self.title = T(title, LABEL, color, bold=True).next_to(self.base, DOWN, buff=0.18)
        # an invisible box that keeps the column height, so move_to and next_to see the full size
        self.room = Rectangle(width=width, height=max_frames * (frame_h + gap), stroke_opacity=0, fill_opacity=0)
        self.room.next_to(self.base, UP, buff=0)
        self.frames: list[_Item] = []
        self._gone: list[_Item] = []
        self.add(self.room, self.base, self.title)

    def slot_center(self, i):
        """Center of frame slot i (0 = bottom)."""
        y = self.base.get_y() + self.gap + i * (self.frame_h + self.gap) + self.frame_h / 2
        return np.array([self.base.get_x(), y, 0.0])

    @property
    def used(self):
        """Pancake slots in use (a cube can take several)."""
        return sum(f.slots for f in self.frames)

    def next_slot(self):
        """Where the next pushed frame goes."""
        return self.slot_center(self.used)

    @property
    def top(self):
        return self.frames[-1] if self.frames else None

    def _gc(self):
        for m in self._gone:
            self.remove(m)
        self._gone.clear()

    def push(self, label, color=None, mono=None, source=None) -> Animation:
        """A new frame drops onto the top of the stack. source: a mobject (for example a queue
        item) that turns into the frame instead."""
        self._gc()
        if self.used >= self.max_frames:
            raise ValueError(f"CallStack holds max_frames={self.max_frames}; raise it to push {label!r}")
        f = _Item(label, color or self.color_, self.width_, self.frame_h, self.mono if mono is None else mono,
                  shape="pancake")
        if f.box.width > self.width_ + 1e-6:
            raise ValueError(f"frame {label!r} is {f.box.width:.2f} wide; CallStack width is {self.width_}")
        f.move_to(self.next_slot())
        self.frames.append(f)
        self.add(f)
        if source is None:
            return _appear(f, UP * _DROP)
        target = f.copy()
        f.become(source.copy())
        return Transform(f, target)

    def push_cube(self, label=None, slots=None, mono=True) -> Animation:
        """A white cube (sync code that runs) drops onto the stack. slots: how many pancake slots it
        takes (default: every free slot, so the cube fills the column)."""
        self._gc()
        free = self.max_frames - self.used
        slots = free if slots is None else slots
        if slots < 1 or slots > free:
            raise ValueError(f"push_cube needs {slots} slots; {free} are free (max_frames={self.max_frames})")
        h = slots * (self.frame_h + self.gap) - self.gap
        f = _Item(label, TEXT, self.width_, h, mono, shape="cube")
        if f.box.width > self.width_ + 1e-6:
            raise ValueError(f"cube label {label!r} is {f.box.width:.2f} wide; CallStack width is {self.width_}")
        lo, hi = self.slot_center(self.used), self.slot_center(self.used + slots - 1)
        f.move_to((lo + hi) / 2)
        f.slots = slots
        self.frames.append(f)
        self.add(f)
        return _appear(f, UP * _DROP)

    def pop(self) -> Animation:
        """The top frame lifts off and fades (the function returned)."""
        self._gc()
        if not self.frames:
            raise ValueError("pop on an empty CallStack")
        f = self.frames.pop()
        self._gone.append(f)
        return _leave(f, shift=UP * _DROP)

    def clear(self) -> Animation:
        """Every frame lifts off at once (the stack empties)."""
        self._gc()
        anims = []
        while self.frames:
            f = self.frames.pop()
            self._gone.append(f)
            anims.append(_leave(f, shift=UP * _DROP))
        return AnimationGroup(*anims, group=self) if anims else Wait(0.01)

    def mark_top(self, color) -> Animation:
        """Recolor the top frame (for example red for a frame that never returns)."""
        f = self.top
        return f.box.animate.set_stroke(color).set_fill(color)


class LoopQueue(VGroup):
    """A first-in, first-out queue drawn as a tray: items join at the back (right) and leave from
    the front (left).

    .tray, .title, .items (front first). enqueue(label) and dequeue(to=...) return animations.
    The tray width is fixed; an item that does not fit raises ValueError.
    Use TASK for the task queue and MICROTASK for the microtask queue.
    shape: box (the label inside a box), ball (big ball, a task), small_ball (a microtask).
    With a ball shape the label (optional) sits under the ball; labels=False makes a lower tray.
    """

    def __init__(self, title="task queue", color=TASK, width=6.0, item_h=0.5, gap=0.12, title_side=UP,
                 mono=False, shape="box", labels=True, **kw):
        super().__init__(**kw)
        self.color_, self.gap, self.mono, self.shape = color, gap, mono, shape
        self.pad = 0.2 if shape in BALL_R else 0.12  # space between the tray edge and the front item
        if shape in BALL_R:
            item_h = 2 * BALL_R[shape] + (0.4 if labels else 0)
        self.item_h = item_h
        self.tray = RoundedRectangle(corner_radius=0.1, width=width, height=item_h + 0.24, stroke_color=color,
                                     stroke_width=3, fill_color=color, fill_opacity=0.06)
        self.front_mark = T("front", SMALL, MUTED).next_to(self.tray, LEFT, buff=0.15)
        self.title = T(title, LABEL, color, bold=True)
        self.title.next_to(self.tray, title_side, buff=0.15)
        if np.allclose(title_side, UP) or np.allclose(title_side, DOWN):
            self.title.align_to(self.tray, LEFT)
        self.items: list[_Item] = []
        self._gone: list[_Item] = []
        self.add(self.tray, self.title)

    def show_front(self, on=True):
        """Add (or remove) the grey word 'front' left of the tray. Call before you add the queue."""
        (self.add if on else self.remove)(self.front_mark)
        return self

    def _x_after(self, items):
        x = self.tray.get_left()[0] + self.pad
        for it in items:
            x += it.width + self.gap
        return x

    def _gc(self):
        for m in self._gone:
            self.remove(m)
        self._gone.clear()

    @property
    def front(self):
        return self.items[0] if self.items else None

    def enqueue(self, label, color=None, mono=None, source=None) -> Animation:
        """A new item joins at the back. source: a point or mobject it flies in from (default: from the right)."""
        self._gc()
        it = _Item(label, color or self.color_, None, self.item_h, self.mono if mono is None else mono,
                   shape=self.shape)
        x = self._x_after(self.items)
        if x + it.width > self.tray.get_right()[0] - 0.1:
            raise ValueError(f"item {label!r} does not fit in queue {self.title.text!r}; widen it or dequeue first")
        it.move_to([x + it.width / 2, self.tray.get_y(), 0])
        self.items.append(it)
        self.add(it)
        if source is None:
            return _appear(it, RIGHT * _DROP)
        target = it.copy()
        it.move_to(source.get_center() if isinstance(source, Mobject) else source).set_opacity(0.0)
        return Transform(it, target)

    def dequeue(self, to=None, vanish=False) -> Animation:
        """The front item leaves (to a point or mobject, fading on the way); the rest move up one place.
        vanish=True hides it at once (run_next uses it: a copy of the item becomes a frame)."""
        self._gc()
        if not self.items:
            raise ValueError(f"dequeue on an empty queue {self.title.text!r}")
        it = self.items.pop(0)
        self._gone.append(it)
        if vanish:
            it.set_opacity(0)
            anims = []
        else:
            anims = [_leave(it, to=to, shift=LEFT * _DROP)]
        x = self.tray.get_left()[0] + self.pad
        for rest in self.items:
            anims.append(rest.animate.move_to([x + rest.width / 2, rest.get_y(), 0]))
            x += rest.width + self.gap
        return AnimationGroup(*anims, group=self) if anims else Wait(1 / config.frame_rate)


def run_next(queue: LoopQueue, stack: CallStack, label=None, color=None) -> Animation:
    """The loop takes the front item of `queue` and runs it: the item (a ball) flies to the top of
    `stack` and turns into a new pancake there (label defaults to the item's label). The rest of
    the queue moves up one place."""
    item = queue.front
    if item is None:
        raise ValueError(f"run_next: queue {queue.title.text!r} is empty")
    src = item.copy()
    push = stack.push(label or item.label, color=color or item.concept_color, source=src)
    return AnimationGroup(queue.dequeue(vanish=True), push, group=stack)


class LoopArrow(VGroup):
    """The event loop as one circular arrow with its title (script `event_loop`, `blocking`).

    .arc (with its tip), .title. turn() spins the arrow; sleep() and wake() dim and relight it
    (the loop sleeps when the queues are empty); freeze() greys it (the loop cannot turn while
    a cube fills the call stack), thaw() undoes freeze.
    """

    def __init__(self, radius=0.6, title="event loop", color=LOOP, stroke_width=6, **kw):
        super().__init__(**kw)
        self.color_, self.sw = color, stroke_width
        self.arc = Arc(radius=radius, start_angle=100 * DEGREES, angle=-310 * DEGREES, stroke_color=color,
                       stroke_width=stroke_width)
        self.arc.add_tip(tip_length=0.22, tip_width=0.22)
        self.center_dot = Dot(ORIGIN, radius=0.001, fill_opacity=0)  # keeps the ring center
        self.title = T(title, LABEL, color, bold=True).next_to(self.arc, DOWN, buff=0.18) if title else VGroup()
        self.add(self.center_dot, self.arc, self.title)

    @property
    def center_point(self):
        return self.center_dot.get_center()

    def turn(self, turns=1.0) -> Animation:
        """The arrow spins clockwise `turns` times."""
        return Rotate(self.arc, angle=-TAU * turns, about_point=self.center_point)

    def _set(self, color, op) -> Animation:
        tip = self.arc.tip
        anims = [self.arc.animate.set_stroke(color, opacity=op, family=False),
                 tip.animate.set_fill(color, opacity=op).set_stroke(color, opacity=op)]
        if len(self.title):
            anims.append(self.title.animate.set_opacity(max(op, 0.35)))
        return AnimationGroup(*anims, group=self)

    def sleep(self) -> Animation:
        return self._set(self.color_, DIM)

    def wake(self) -> Animation:
        return self._set(self.color_, 1.0)

    def freeze(self) -> Animation:
        return self._set(MUTED, 1.0)

    def thaw(self) -> Animation:
        return self._set(self.color_, 1.0)
