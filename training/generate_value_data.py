import argparse
import json
import random
from pathlib import Path

import numpy as np

SIZE = 15
EMPTY = 0
HUMAN = 1
AI = 2
DIRS = [(1, 0), (0, 1), (1, 1), (1, -1)]
WIN = 10_000_000


def create_board():
    return np.zeros((SIZE, SIZE), dtype=np.int8)


def inside(r, c):
    return 0 <= r < SIZE and 0 <= c < SIZE


def is_win(board, r, c, player):
    for dr, dc in DIRS:
        count = 1
        count += count_dir(board, r, c, dr, dc, player)
        count += count_dir(board, r, c, -dr, -dc, player)
        if count >= 5:
            return True
    return False


def count_dir(board, r, c, dr, dc, player):
    n = 0
    nr, nc = r + dr, c + dc
    while inside(nr, nc) and board[nr, nc] == player:
        n += 1
        nr += dr
        nc += dc
    return n


def generate_candidates(board):
    coords = set()
    stones = np.argwhere(board != EMPTY)
    if len(stones) == 0:
        return [(7, 7)]

    for r, c in stones:
        for dr in range(-2, 3):
            for dc in range(-2, 3):
                nr, nc = int(r) + dr, int(c) + dc
                if inside(nr, nc) and board[nr, nc] == EMPTY:
                    coords.add((nr, nc))

    return list(coords)


def line_info(board, r, c, dr, dc, player):
    count = 1
    open_ends = 0

    nr, nc = r + dr, c + dc
    while inside(nr, nc) and board[nr, nc] == player:
        count += 1
        nr += dr
        nc += dc
    if inside(nr, nc) and board[nr, nc] == EMPTY:
        open_ends += 1

    nr, nc = r - dr, c - dc
    while inside(nr, nc) and board[nr, nc] == player:
        count += 1
        nr -= dr
        nc -= dc
    if inside(nr, nc) and board[nr, nc] == EMPTY:
        open_ends += 1

    return count, open_ends


def local_move_score(board, r, c, player):
    if board[r, c] != EMPTY:
        return -10**18

    board[r, c] = player
    score = 0

    if is_win(board, r, c, player):
        score += WIN

    for dr, dc in DIRS:
        count, open_ends = line_info(board, r, c, dr, dc, player)
        if count >= 5:
            score += WIN
        elif count == 4 and open_ends == 2:
            score += 1_400_000
        elif count == 4 and open_ends == 1:
            score += 280_000
        elif count == 3 and open_ends == 2:
            score += 85_000
        elif count == 3 and open_ends == 1:
            score += 10_000
        elif count == 2 and open_ends == 2:
            score += 2_600
        elif count == 2 and open_ends == 1:
            score += 450
        else:
            score += 60 + center_score(r, c)

    board[r, c] = EMPTY
    return score


def threat_class(board, r, c, player):
    board[r, c] = player
    four = 0
    open_three = 0

    for dr, dc in DIRS:
        count, open_ends = line_info(board, r, c, dr, dc, player)
        if count >= 5:
            board[r, c] = EMPTY
            return 10
        if count >= 4 and open_ends >= 1:
            four += 1
        if count == 3 and open_ends == 2:
            open_three += 1

    board[r, c] = EMPTY

    if four >= 2:
        return 7
    if four >= 1 and open_three >= 1:
        return 6
    if open_three >= 2:
        return 5
    if four >= 1:
        return 3
    if open_three >= 1:
        return 2
    return 0


def move_threat_score(board, r, c, player):
    cls = threat_class(board, r, c, player)
    if cls >= 10:
        return WIN
    if cls >= 7:
        return 1_600_000
    if cls >= 6:
        return 1_100_000
    if cls >= 5:
        return 820_000
    if cls >= 3:
        return 160_000
    if cls >= 2:
        return 45_000
    return 0


def center_score(r, c):
    return 22 - abs(7 - r) - abs(7 - c)


def teacher_move(board, player):
    candidates = generate_candidates(board)
    opponent = HUMAN if player == AI else AI

    for r, c in candidates:
        board[r, c] = player
        win = is_win(board, r, c, player)
        board[r, c] = EMPTY
        if win:
            return r, c

    for r, c in candidates:
        board[r, c] = opponent
        win = is_win(board, r, c, opponent)
        board[r, c] = EMPTY
        if win:
            return r, c

    scored = []
    for r, c in candidates:
        attack = local_move_score(board, r, c, player)
        defense = local_move_score(board, r, c, opponent)
        threat = move_threat_score(board, r, c, player)
        block_threat = move_threat_score(board, r, c, opponent)
        score = attack + defense * 1.25 + threat * 0.75 + block_threat * 0.95 + center_score(r, c)
        scored.append((score, r, c))

    scored.sort(reverse=True)
    if len(scored) > 1 and random.random() < 0.10:
        top = scored[: min(4, len(scored))]
        return random.choice(top)[1:]
    return scored[0][1], scored[0][2]


def encode_board(board, player):
    opponent = HUMAN if player == AI else AI
    x = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
    x[:, :, 0] = (board == player).astype(np.float32)
    x[:, :, 1] = (board == opponent).astype(np.float32)
    x[:, :, 2] = 1.0 if player == AI else 0.0
    return x


def play_game(max_moves):
    board = create_board()
    player = AI if random.random() < 0.5 else HUMAN
    history = []
    winner = 0

    for _ in range(max_moves):
        if len(generate_candidates(board)) == 0:
            break

        history.append((encode_board(board, player), player))
        r, c = teacher_move(board, player)
        board[r, c] = player

        if is_win(board, r, c, player):
            winner = player
            break

        player = HUMAN if player == AI else AI

    xs = []
    values = []
    for encoded, perspective in history:
        if winner == 0:
            value = 0.0
        elif winner == perspective:
            value = 1.0
        else:
            value = -1.0
        xs.append(encoded)
        values.append(value)

    return xs, values, winner


def generate_games(num_games, max_moves):
    xs = []
    ys = []
    results = {"ai": 0, "human": 0, "draw": 0}

    for game_idx in range(num_games):
        game_x, game_y, winner = play_game(max_moves)
        xs.extend(game_x)
        ys.extend(game_y)

        if winner == AI:
            results["ai"] += 1
        elif winner == HUMAN:
            results["human"] += 1
        else:
            results["draw"] += 1

        if (game_idx + 1) % 100 == 0:
            print(f"generated {game_idx + 1}/{num_games} games")

    return np.stack(xs), np.array(ys, dtype=np.float32), results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--games", type=int, default=2000)
    parser.add_argument("--max-moves", type=int, default=90)
    parser.add_argument("--out", type=str, default="training/data/value_data.npz")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    x, y, results = generate_games(args.games, args.max_moves)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out_path, x=x, y=y)

    meta = {
        "games": args.games,
        "positions": int(len(y)),
        "board_size": SIZE,
        "channels": 3,
        "results": results,
    }
    out_path.with_suffix(".json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"saved {len(y)} positions to {out_path}")
    print(results)


if __name__ == "__main__":
    main()
