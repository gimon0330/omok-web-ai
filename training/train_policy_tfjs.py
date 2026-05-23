import argparse
from pathlib import Path

import numpy as np
import tensorflow as tf
import tensorflowjs as tfjs

SIZE = 15
NUM_MOVES = SIZE * SIZE


def build_model():
    inputs = tf.keras.Input(shape=(SIZE, SIZE, 3), name="board")

    x = tf.keras.layers.Conv2D(48, 3, padding="same", activation="relu")(inputs)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu")(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Conv2D(32, 1, padding="same", activation="relu")(x)
    x = tf.keras.layers.Flatten()(x)
    x = tf.keras.layers.Dense(256, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.15)(x)
    outputs = tf.keras.layers.Dense(NUM_MOVES, activation="softmax", name="policy")(x)

    model = tf.keras.Model(inputs=inputs, outputs=outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy", top_k_accuracy],
    )
    return model


def top_k_accuracy(y_true, y_pred):
    y_true = tf.cast(tf.reshape(y_true, [-1]), tf.int32)
    return tf.keras.metrics.sparse_top_k_categorical_accuracy(y_true, y_pred, k=5)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=str, default="training/data/policy_data.npz")
    parser.add_argument("--out", type=str, default="assets/policy-net")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=256)
    args = parser.parse_args()

    data = np.load(args.data)
    x = data["x"].astype(np.float32)
    y = data["y"].astype(np.int64)

    indices = np.arange(len(y))
    np.random.shuffle(indices)
    x = x[indices]
    y = y[indices]

    split = int(len(y) * 0.9)
    x_train, y_train = x[:split], y[:split]
    x_val, y_val = x[split:], y[split:]

    model = build_model()
    model.summary()

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=3,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=2,
            min_lr=1e-5,
        ),
    ]

    model.fit(
        x_train,
        y_train,
        validation_data=(x_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=callbacks,
        shuffle=True,
    )

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    tfjs.converters.save_keras_model(model, str(out_dir))
    print(f"saved TensorFlow.js model to {out_dir}")


if __name__ == "__main__":
    main()
