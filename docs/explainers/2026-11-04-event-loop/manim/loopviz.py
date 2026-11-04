"""Event loop visuals that many parts use: a call stack, task and microtask queues, the libuv ring.

Shared base file. Part agents do not edit it. Ask for a change in your report.

    from dwscene import *                      # also imports CallStack, LoopQueue, PhaseRing, run_next

    stack = CallStack().move_to(LEFT * 4.5)
    micro = LoopQueue("microtask queue", MICROTASK).move_to(RIGHT * 1.5 + UP * 1.2)
    self.add(stack, micro)                     # or FadeIn(...)
    self.play(stack.push("main()"), run_time=b.t(0.2))
    self.play(micro.enqueue("then cb"), run_time=b.t(0.2))
    self.play(stack.pop(), run_time=b.t(0.2))
    self.play(run_next(micro, stack), run_time=b.t(0.2))   # front item -> new top frame

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

from style import LABEL, MICROTASK, MUTED, PHASE, SMALL, STACK, TASK, TEXT, T, lines

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


class _Item(VGroup):
    """A frame or a queue item: .box and .text."""

    def __init__(self, label, color, width, height, mono, size=SMALL, fill=0.22):
        super().__init__()
        self.text = T(label, size, TEXT, mono=mono)
        w = max(width or 0, self.text.width + 0.36)
        self.box = RoundedRectangle(corner_radius=0.08, width=w, height=height, stroke_color=color,
                                    stroke_width=2.5, fill_color=color, fill_opacity=fill)
        self.text.move_to(self.box)
        self.label, self.concept_color = label, color
        self.add(self.box, self.text)


class CallStack(VGroup):
    """A column of frames that grows up from a base line. Title under the base line.

    .base, .title, .frames (bottom first). push(label) and pop() return animations.
    max_frames sets the height the column keeps free; push past it raises ValueError.
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

    def next_slot(self):
        """Where the next pushed frame goes."""
        return self.slot_center(len(self.frames))

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
        if len(self.frames) >= self.max_frames:
            raise ValueError(f"CallStack holds max_frames={self.max_frames}; raise it to push {label!r}")
        f = _Item(label, color or self.color_, self.width_, self.frame_h, self.mono if mono is None else mono)
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
    """A FIFO queue drawn as a tray: items join at the back (right) and leave from the front (left).

    .tray, .title, .items (front first). enqueue(label) and dequeue(to=...) return animations.
    The tray width is fixed; an item that does not fit raises ValueError.
    Use TASK for the task queue and MICROTASK for the microtask and next tick queues.
    """

    def __init__(self, title="task queue", color=TASK, width=6.0, item_h=0.5, gap=0.12, title_side=UP,
                 mono=False, **kw):
        super().__init__(**kw)
        self.color_, self.item_h, self.gap, self.mono = color, item_h, gap, mono
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
        x = self.tray.get_left()[0] + 0.12
        for it in items:
            x += it.box.width + self.gap
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
        it = _Item(label, color or self.color_, None, self.item_h, self.mono if mono is None else mono)
        x = self._x_after(self.items)
        if x + it.box.width > self.tray.get_right()[0] - 0.1:
            raise ValueError(f"item {label!r} does not fit in queue {self.title.text!r}; widen it or dequeue first")
        it.move_to([x + it.box.width / 2, self.tray.get_y(), 0])
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
        x = self.tray.get_left()[0] + 0.12
        for rest in self.items:
            anims.append(rest.animate.move_to([x + rest.box.width / 2, rest.get_y(), 0]))
            x += rest.box.width + self.gap
        return AnimationGroup(*anims, group=self) if anims else Wait(1 / config.frame_rate)


def run_next(queue: LoopQueue, stack: CallStack, label=None, color=None) -> Animation:
    """The loop takes the front item of `queue` and runs it: the item flies to the top of `stack`
    and turns into a new frame there (label defaults to the item's label). The rest of the queue
    moves up one place."""
    item = queue.front
    if item is None:
        raise ValueError(f"run_next: queue {queue.title.text!r} is empty")
    src = item.copy()
    push = stack.push(label or item.label, color=color or item.concept_color, source=src)
    return AnimationGroup(queue.dequeue(vanish=True), push, group=stack)


class PhaseRing(VGroup):
    """The six libuv phases as a ring of arcs, clockwise from timers, with a marker that moves.

    .arcs[name], .labels[name], .marker. Names: PhaseRing.PHASES.
    move_to_phase(name) turns the marker clockwise to that phase (through the phases between).
    light(name) and dim(*names) restyle arcs. point(name, out) gives a point on the ring at
    the middle of a phase (out > 0: outside the ring), for placing a queue next to a phase.
    """

    PHASES = ("timers", "pending", "idle", "poll", "check", "close")
    LABELS = {"timers": ("timers",), "pending": ("pending", "callbacks"), "idle": ("idle,", "prepare"),
              "poll": ("poll",), "check": ("check",), "close": ("close", "callbacks")}

    def __init__(self, radius=1.5, color=PHASE, start_angle=90 * DEGREES, labels=None, arc_width=10,
                 title="event loop (libuv)", **kw):
        super().__init__(**kw)
        self.radius, self.color_, self.start, self.arc_width = radius, color, start_angle, arc_width
        self.span = TAU / 6
        self.arcs, self.labels = {}, {}
        labels = labels or self.LABELS
        gap = 0.1
        for i, ph in enumerate(self.PHASES):
            mid = self.mid_angle(ph)
            arc = Arc(radius=radius, start_angle=mid + self.span / 2 - gap / 2, angle=-(self.span - gap),
                      stroke_color=color, stroke_width=arc_width)
            d = np.array([np.cos(mid), np.sin(mid), 0.0])
            al = LEFT if d[0] > 0.3 else (RIGHT if d[0] < -0.3 else ORIGIN)
            lbl = lines(*labels[ph], size=SMALL, color=color, buff=0.04, align=al)
            edge = LEFT if d[0] > 0.3 else (RIGHT if d[0] < -0.3 else (DOWN if d[1] > 0 else UP))
            lbl.move_to(d * (radius + 0.22), aligned_edge=edge)
            self.arcs[ph], self.labels[ph] = arc, lbl
            self.add(arc, lbl)
        self.title = T(title, SMALL, color, bold=True) if title else VGroup()
        self.add(self.title)
        self.place_title()
        self.marker = Triangle(fill_color=TEXT, fill_opacity=1, stroke_width=0).scale(0.13)
        self._angle = self.mid_angle("timers")
        self.marker.rotate(self._angle - PI)  # the tip points along the ring, clockwise
        self.marker.move_to(self._ring_point(self._angle, -0.32))
        self.add(self.marker)

    def mid_angle(self, name):
        return self.start - self.PHASES.index(name) * self.span

    def _ring_point(self, angle, out=0.0):
        return self.arcs[self.PHASES[0]].get_arc_center() + np.array([np.cos(angle), np.sin(angle), 0]) * (
            self.radius + out)

    def point(self, name, out=0.0):
        """A point at the middle of phase `name`, `out` units outside the ring (negative: inside)."""
        return self._ring_point(self.mid_angle(name), out)

    @property
    def center_point(self):
        return self.arcs[self.PHASES[0]].get_arc_center()

    def move_to_phase(self, name, turns=0) -> Animation:
        """Turn the marker clockwise to phase `name`. turns=1 adds a full extra lap."""
        delta = (self._angle - self.mid_angle(name)) % TAU + turns * TAU
        self._angle -= delta
        return Rotate(self.marker, angle=-delta, about_point=self.center_point)

    def light(self, *names, color=None) -> Animation:
        """Thicken and brighten the arcs (and labels) of `names`."""
        anims = []
        for n in names:
            anims.append(self.arcs[n].animate.set_stroke(color or self.color_, width=self.arc_width * 1.6, opacity=1))
            anims.append(self.labels[n].animate.set_opacity(1))
        return AnimationGroup(*anims, group=self)

    def dim(self, *names, opacity=0.25) -> Animation:
        """Grey out the arcs of `names` (all phases when no name is given)."""
        names = names or self.PHASES
        anims = []
        for n in names:
            anims.append(self.arcs[n].animate.set_stroke(width=self.arc_width, opacity=opacity))
            anims.append(self.labels[n].animate.set_opacity(max(opacity, 0.35)))
        return AnimationGroup(*anims, group=self)

    def normal(self) -> Animation:
        """Every arc back to its first look."""
        anims = []
        for n in self.PHASES:
            anims.append(self.arcs[n].animate.set_stroke(self.color_, width=self.arc_width, opacity=1))
            anims.append(self.labels[n].animate.set_opacity(1))
        return AnimationGroup(*anims, group=self)

    def place_title(self, direction=DOWN, buff=0.3):
        """Put the title under (the default) or beside the ring and its labels."""
        rest = VGroup(*self.arcs.values(), *self.labels.values())
        self.title.next_to(rest, direction, buff=buff)
        return self
