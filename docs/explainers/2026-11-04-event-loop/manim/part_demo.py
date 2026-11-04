"""Demo of the shared base: open a part on the outline, a short loopviz run, close the part.
Not a script scene. It borrows the length of `call_stack` (part_stack)."""
from dwscene import *


class DemoLoopviz(DWScene):
    SCENE = "call_stack"
    BEATS = [("open", 2), ("setup", 1.5), ("push", 3), ("micro", 4), ("drain", 3), ("close", 2)]

    def construct(self):
        outline = OutlineDiagram()
        with self.beat("open") as b:
            self.add(outline)
            self.wait(b.t(0.2))
            outline.open_part(self, "main_thread", also=("call_stack",), run_time=b.left)

        with self.beat("setup") as b:
            title = scene_title("One turn of the loop (demo)", STACK)
            stack = CallStack(width=3.7, max_frames=5).move_to([-4.2, -0.15, 0])
            micro = LoopQueue("microtask queue", MICROTASK, width=6.2).move_to([2.6, 2.0, 0])
            ring = PhaseRing(radius=0.85).move_to([2.9, -0.95, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(stack), FadeIn(micro), FadeIn(ring),
                      run_time=b.t(0.8))

        with self.beat("push") as b:
            self.play(stack.push("main()"), run_time=b.t(0.25))
            self.play(stack.push("ping()"), run_time=b.t(0.25))
            self.play(stack.pop(), run_time=b.t(0.25))

        with self.beat("micro") as b:
            self.play(micro.enqueue("then cb", mono=True), run_time=b.t(0.2))
            self.play(micro.enqueue("queueMicrotask cb", mono=True), run_time=b.t(0.2))
            self.play(stack.pop(), run_time=b.t(0.2))
            note = caption("stack empty: microtasks run before the next phase")
            self.play(FadeIn(note), run_time=b.t(0.15))

        with self.beat("drain") as b:
            self.play(run_next(micro, stack), run_time=b.t(0.25))
            self.play(stack.pop(), run_time=b.t(0.15))
            self.play(run_next(micro, stack), run_time=b.t(0.25))
            self.play(stack.pop(), ring.move_to_phase("poll"), run_time=b.t(0.3))

        with self.beat("close") as b:
            outline.close_part(self, "main_thread", next_key="microtask_queue", run_time=b.left)
